# START HERE — first-run brief for the coding agent

**You are the coding agent in this repository.** Follow this once, top to bottom.
After setup, **`AGENTS.md` drives every task** — this file just gets you there.

You are an *untrusted committer*: free to write anything on a branch, unable to
merge what the hard checks reject. That is by design — work with it. (Full tier
model: `OPERATING.md`; the rationale: `README.md`.)

---

## PHASE 1 — Setup (do this once, now)

Run these and report the result of each:

1. `python bootstrap.py` — installs the Python dep, writes `boundaries.yaml` and
   `docs/STACK.md` (never overwrites existing files).
2. Install the validator(s) for this repo's stack, plus `pip install pyyaml`:
   - **TS/JS:** `npm i -D dependency-cruiser`; ensure `typecheck` / `lint` / `test`
     scripts exist in `package.json`.
   - **Python:** `pip install import-linter`; set `python.root_package` in
     `boundaries.yaml` to the importable top-level package.
3. **Edit `boundaries.yaml`** so the modules match THIS app's domains. Show the
   diff and explain your choices in plain language, then run
   `python bigbrainBoundaryGuard/check_boundaries.py doctor` (it fails if a module
   points at no real files).
4. **Fill in `docs/STACK.md`** with the real stack, versions, and conventions. If
   unsure of a version or API, fetch live docs and **cite what you fetched**.
5. `python bigbrain_verify.py` — confirm the cycle runs. (Some steps may say
   "nothing to run" until there's real code; that's fine.)
6. Confirm `AGENTS.md` and `CLAUDE.md` both exist at the repo root (bootstrap
   creates the `CLAUDE.md` pointer if missing). Both resolve to the same content;
   edit `AGENTS.md`.

*(Optional) Code graph.* If a `graphify-out/` graph exists, the agents will query
it instead of scanning files. If one would help and Graphify is already installed,
use it. If it is **not** installed, do **not** auto-install it — offer it to your
human (`uv tool install graphifyy`, double-y) and wait, the same way you don't
configure your own gates. `docs/ARCHITECTURE.md` is the zero-dependency default and
stays the source of *intent* either way; the graph is a faster *navigation* layer
on top, not a replacement.

---

## PHASE 2 — STOP. Hand off to your human.

Two settings live on the git host, not in these files, and **one you must not do
yourself.** Tell your human, verbatim:

> Two one-time settings are needed before I do real work:
> **(a)** Make `boundaries`, `verify`, and `pr-size` **required** status checks on
> `main`, and block direct pushes. Run `python bootstrap.py --protect` if your
> `gh` CLI has repo admin, or set it in repo settings.
> **(b)** Scope **my** token to *Contents + PR write only, NO Administration* — so
> I cannot disable the checks that constrain me. **This one is yours, not mine:**
> if I could set my own permissions, the enforcement would be meaningless.
> Details are in `BRANCH_PROTECTION.md`.

Until your human confirms (a) and (b), the hard tier is **not standing** — your
self-discipline is the only thing holding. If you proceed before then, say so
explicitly so no one mistakes "followed instructions" for "enforced."

---

## PHASE 3 — From here, `AGENTS.md` drives every task.

Read `AGENTS.md` and follow its cycle on every change: orient → plan (first
vertical slice) → generate (don't hand-roll) → TDD → verify → prove it → small PR.
Building something new? The generator stamps the skeleton; wire **one vertical
slice** end-to-end before breadth (`bigbrainSoftwareArchitectureJudgmentRouter/rules/11`).

Everything you *say* you did is surfaced — earn trust by showing evidence.
Boundaries, small PRs, and branch protection are guaranteed by machine (plus a
coverage floor once your human arms it). Don't mistake following these
instructions for being enforced by them.
