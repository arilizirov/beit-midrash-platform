# bigbrain agent kit

**Agent: read `START_HERE.md` first.** It's the cold-start brief — setup, the one
human handoff, then the per-task loop. Humans: `OPERATING.md` is your runbook.

A drop-in kit that makes an AI coding agent behave like a disciplined senior engineer:
plan before coding, work test-first (TDD), keep it simple (KISS), make the smallest safe
change, verify, and route hard problems to source-derived judgment instead of guessing.

## Layout

```
bootstrap.py                           run once per repo — installs deps, writes config, sets protection (what a script CAN)
AGENTS.md                              read first, every task — the cycle, habits, gates, routing
bigbrain_verify.py                     ONE command for the whole cycle: typecheck + lint + test + boundaries
docs/STACK.template.md                 freshness layer — copy to docs/STACK.md; current versions/conventions
.gitignore                             sane ignores; secrets blocked at the top
package.sample.json                    TypeScript check commands AGENTS.md expects
pyproject.sample.toml                  Python check commands AGENTS.md expects
bigbrainSoftwareArchitectureJudgmentRouter/   the "software brain" — code/architecture judgment
bigbrainDataArchitectureJudgmentRouter/       the "data brain"     — schema/pipeline/data judgment
bigbrainBoundaryGuard/                 the "wall" — MECHANICAL boundary enforcement (boundaries.yaml + dispatcher)
bigbrainGenerator/                     enforcement BY CONSTRUCTION — stamps a correct domain, registers it
bigbrainReviewer/                      the LLM critic — advisory PR review (a second intelligence)
bigbrainQA/                            e2e + post-deploy smoke + audits (top of the test pyramid)
bigbrainSkillCheck/                    skill-lint — checks the skills are well-formed & consistent (CI gate)
bigbrainEval/                          eval harness — measures whether a skill changes agent behavior (opt-in, soft)
tests/                                 tests for the kit's OWN tools (+ a zero-dependency runner)
.pre-commit-config.sample.yaml         cross-platform local fast feedback (works on Windows)
.github/workflows/boundaries.yml       required check: boundaries (runs outside the agent)
.github/workflows/gates.yml            required checks: verify + small-PR limit + tool-tests + skill-lint
.github/workflows/qa.yml               e2e + dependency audit + secret scan
.github/workflows/review.yml           advisory: posts the LLM critic's findings on each PR
BRANCH_PROTECTION.md                   runbook: the git-host settings that make the wall bind (your job)
```

## How to deploy

Copy the kit into your repo, then run the bootstrap **once**:

```bash
python bootstrap.py            # installs deps, writes boundaries.yaml + docs/STACK.md (no overwrites)
python bootstrap.py --protect  # also sets branch protection, if `gh` has repo admin
```

It does everything a script *can*. It cannot do the rest — and that's by design,
because **enforcement lives outside the files the enforced party controls**
(that's the whole reason it works). The irreducible residue, which bootstrap
prints for you:

1. Edit `boundaries.yaml` so the domains match *your* app.
2. Make `boundaries`, `verify`, and `pr-size` **required** checks on `main` and
   block direct pushes (re-run `--protect`, or do it in repo settings).
3. Scope the **agent's token**: Contents + PR write only, **no Administration** —
   so the agent (an untrusted committer) can't disable the rule.
4. Optional: add the `ANTHROPIC_API_KEY` secret to turn on the LLM reviewer.

Details in `BRANCH_PROTECTION.md`. Both brains must be present for `AGENTS.md`'s
routing to work.

> **No PRs = no enforcement, at all.** The entire hard tier (boundaries, gates,
> coverage) is enforced by CI checks gating *pull request merges*. If you push
> straight to `main` with no PR workflow, none of it runs — you're left with only
> the surfaced tier (the agent's self-discipline). The kit assumes a PR-based
> flow on a host with required checks; without that, treat every guarantee in
> this README as merely advisory.

> **Why not zero-touch?** A file in a zip can't configure a server it doesn't
> control (branch protection), and your domains differ per project
> (`boundaries.yaml`). And `AGENTS.md` is *read* by the agent, it doesn't
> execute — the chaining you want is real, but it lives in three runnable/read
> pieces: `bootstrap.py` (chains setup) → `bigbrain_verify.py` (chains the
> checks) → `AGENTS.md` (tells the agent to run them).

## How it stays disciplined

Three kinds of discipline. Be honest about which is which — that honesty is the point.

**Surfaced (the agent self-reports — strong only if a human reads it):**

- **State** — `AGENTS.md` carries the cycle and habits, read every task.
- **Gate** — tripwires fire before the tempting wrong move (no implementation before a
  failing test; no abstraction without a present-day force; no boundary crossing the policy forbids).
- **Prove** — the final-response template makes the agent show red→green and state what it
  deliberately did NOT build. Catching a skip still depends on someone reading the reply.
- **TDD ordering** — "test first" cannot be machine-verified (by CI time both exist), so it
  stays surfaced. Its *consequence* is enforced instead (coverage, below).

**Stronger soft layer (a second intelligence, still not a guarantee):**

- **Critic** — `bigbrainReviewer` runs an LLM reviewer on the PR diff and posts pushback.
  Another model can be wrong or gamed, so it *flags*, it does not block. It multiplies the
  human reviewer; it never replaces the mechanical floor.

**Enforced (mechanical — the agent cannot self-report past it):**

- **Wall** — module boundaries are a checked-in policy (`boundaries.yaml`) validated by
  `bigbrainBoundaryGuard` in CI under branch protection. An LLM agent is an untrusted
  committer: free to write a violation, unable to merge one, unable to disable the rule.
- **Born correct** — `bigbrainGenerator` stamps each new domain in the right shape and
  registers it in the policy, so structure is correct *by construction*, not by remembering.
- **Coverage floor (arm it)** — set `MIN_COVERAGE` in `gates.yml` (or pass
  `--min-coverage`); CI then blocks merging code that drops below it while still
  allowing refactors. **Off until you set a threshold.** Once armed it's the
  mechanical proxy for TDD.
- **Small PRs** — the `pr-size` gate fails oversized diffs, forcing work into stacked,
  individually-checked stages instead of one unreviewable lump.

The brains are **judgment routers, not book summaries**: each carries short
*original* principle notes (the kit's paraphrase, not the books' text) and tells
the agent to classify the task, route to the few relevant rules, and consult a
note only when the task truly needs that depth.
