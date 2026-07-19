# Branch Protection & the Untrusted-Committer Setup

This is where boundary enforcement actually becomes a **wall**. The
`bigbrainBoundaryGuard` check and the `boundaries.yml` workflow are necessary
but not sufficient: on their own they only *report*. This document covers the
two layers that make them *bind* — and they are settings on your git host that
a script (or this kit) cannot configure for you. **Do them, or the rest is
decoration.**

## The principle

> You cannot make an LLM agent trustworthy. Make trust unnecessary.

Branch protection is strong precisely because the actor it constrains does not
enforce it — the git host's servers do, *downstream of* whoever is committing.
So "make the agent follow the boundary as strongly as branch protection" can
never be achieved by anything the agent says, runs, or self-checks. The agent
**is** the actor. The fix is to treat an LLM coding agent as exactly what it
is — **another untrusted committer** — and put the gate where it cannot reach.

Enforcement is a ladder; each rung is strictly stronger than the last:

1. **Mechanical** — the boundary is a real check (BoundaryGuard), not prose.
2. **Outside the agent** — that check runs in CI on the git host, not in the
   agent's sandbox. You can't `--no-verify` a server you don't control.
3. **Binding** — branch protection requires the check to pass before merge and
   forbids direct pushes. *(Layer 3, below.)*
4. **Unweakenable by the agent** — the agent's token cannot administer the
   repo, so it cannot turn the rule off. *(Layer 4, below.)*

Layers 1–2 ship in this kit. **Layers 3–4 are your job.**

---

## Layer 3 — Branch protection (GitHub)

Settings → Branches → add a rule for `main` (or Settings → Rules → Rulesets).
Require all of:

- **Require a pull request before merging.** No direct pushes to `main`.
- **Require status checks to pass** → add **all three** kit checks by their job
  names: **`boundaries`** (from `boundaries.yml`), **`verify`** and **`pr-size`**
  (from `gates.yml`). Add your own `test`/`typecheck`/`lint` jobs too if separate.
  Enable **"Require branches to be up to date before merging."**
- **Do not allow bypassing the above settings.** This is the rung people skip;
  without it, admins (and admin-scoped tokens) merge straight past a red check.
- **Block force pushes** and **block deletions** on `main`.
- Recommended: **Require review from Code Owners** (see CODEOWNERS below) and
  at least one approving review, so even a *green* build needs a second party
  the agent cannot impersonate.

A red `boundaries` check now physically disables the merge button. Good.

### GitLab equivalent

Settings → Repository → **Protected branches**: set `main` so **No one** can
push and **Maintainers** can merge; enable **Require approval**. Then make the
boundary job a **required** pipeline check (Settings → Merge requests →
"Pipelines must succeed") and disable "Allow merge on skipped pipeline."

> The shipped workflows under `.github/workflows/` are **GitHub Actions**. On
> GitLab, Bitbucket, or Azure DevOps you must port the three jobs (boundaries /
> verify / pr-size) to that host's CI and wire the equivalent required-check +
> protected-branch settings. The Python tools themselves (`check_boundaries.py`,
> `bigbrain_verify.py`) are host-agnostic; only the CI glue is GitHub-specific.

---

## Layer 4 — Least-privilege agent token (the untrusted committer)

Branch protection is pointless if the agent holds a key that can edit branch
protection. Give the agent the *minimum* a contributor needs and nothing more.

**Do:**

- Use a **fine-grained PAT** or a dedicated **GitHub App** for the agent,
  scoped to the one repo, with **Contents: write** and **Pull requests: write**
  — enough to push a branch and open a PR.
- Make the agent **push to a feature branch and open a PR**, never to `main`.
- In CI, keep `permissions:` minimal (the workflow already sets
  `contents: read`). Don't hand workflow tokens broad scopes "just in case."

**Never (these hand the agent the off-switch):**

- ❌ **Administration** permission, or any **Owner/Admin** role.
- ❌ A classic PAT with the broad `repo` scope (it includes admin-ish powers).
- ❌ Ability to **edit rulesets / branch protection**, **dismiss required
  checks**, or **bypass** them as admin.
- ❌ Self-approval of its own PRs, or membership in a bypass/allowlist for the
  required checks.

With layers 3 + 4 in place, the agent is in the **identical** position to a
human developer: free to author a violation on a branch, unable to merge one,
and unable to weaken the rule that stops it. That is the literal fix for
"self-reported, not enforced."

---

## CODEOWNERS (mechanical ownership)

A `CODEOWNERS` file makes "every domain has an owner" enforceable: changes to a
path require that owner's review. Pair it with "Require review from Code
Owners" above.

```
# .github/CODEOWNERS
/src/domains/billing/        @billing-team
/src/domains/users/          @identity-team
/src/platform/               @platform-team
/boundaries.yaml             @architecture-owners   # the policy itself is guarded
# The files that STEER the agent are auto-loaded every session, so a single
# planted line reaches the agent on every task. Guard them like the policy:
/AGENTS.md                   @architecture-owners
/CLAUDE.md                   @architecture-owners
/START_HERE.md               @architecture-owners
/.github/workflows/          @architecture-owners   # the gates themselves
/.claude/                    @architecture-owners   # the debt-hawk subagent (steers review)
/bigbrainBoundaryGuard/      @architecture-owners
/bigbrainReviewer/REVIEWER.md @architecture-owners
```

Guarding `boundaries.yaml` matters: changing the boundary policy should require
the architecture owner, so a PR can't quietly widen the allowlist to sneak a
dependency through. If a boundary genuinely must change, that is a deliberate
PR against `boundaries.yaml` **with an ADR explaining the present-day force** —
never a workaround in feature code.

---

## Optional: an in-loop gate for the agent (speed, not strength)

Two local layers give faster feedback but are **not** the guarantee:

- **pre-commit hook** (`bigbrainBoundaryGuard/hooks/pre-commit.sample`) runs the
  same check on commit — but `git commit --no-verify` skips it, and a fresh
  clone has no hooks until installed. The seatbelt, not the road.
- **Agent-harness gate** — if your agent runner supports a "must pass these
  commands before declaring the task done" hook, point it at
  `check_boundaries.py check`. This gives a non-bypassable check *inside the dev
  loop*, which is genuinely useful. But the durable guarantee still lives in
  CI + branch protection above, because the harness is part of the agent's
  world and the git host is not.

---

## 60-second checklist

```
[ ] boundaries.yaml committed at repo root
[ ] boundaries.yml workflow present; `boundaries` job is green on a PR
[ ] main requires a PR (no direct pushes)
[ ] `boundaries`, `verify`, and `pr-size` are REQUIRED status checks
[ ] "Do not allow bypassing" is ON
[ ] force-push and deletion blocked on main
[ ] agent token = fine-grained, Contents+PR write only, NO Administration
[ ] CODEOWNERS guards domains, boundaries.yaml, the agent instruction files (AGENTS/CLAUDE/START_HERE), and .github/workflows/
[ ] (optional) Code Owner review required; (optional) harness gate wired
```
