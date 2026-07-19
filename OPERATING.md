# OPERATING.md — the system & how to run it

This kit makes an AI coding agent behave like a disciplined senior engineer and
backs the parts that matter with checks the agent **cannot talk past**. This is
the human's runbook. (Pitch + full rationale: `README.md`. Agent's first-run:
`START_HERE.md`.)

---

## 1. The pieces (one line each)

**Judgment (what the agent reads to reason):**
- `AGENTS.md` — read first every task; defines THE CYCLE, habits, gates, routing.
- `bigbrainSoftwareArchitectureJudgmentRouter/` — software judgment, book-derived; classify → route → few relevant rules. Includes the vertical-slice rule (`rules/11`).
- `bigbrainDataArchitectureJudgmentRouter/` — same, for schema/pipeline/data work.
- `docs/STACK.md` — the freshness layer: current versions/conventions (you keep it current). Timeless judgment lives in the brains; current facts here or in live docs the agent fetches.

**Doing (runnable tools):**
- `bootstrap.py` — run once per repo; does all setup a script can.
- `bigbrainGenerator/new_domain.py` — stamps a correct domain + registers it in the boundary policy.
- `bigbrain_verify.py` — ONE command for the whole check cycle (typecheck + lint + test + boundaries).
- `bigbrainBoundaryGuard/` — the policy (`boundaries.yaml`) + dispatcher that enforces module boundaries via dependency-cruiser / import-linter / tach.
- `bigbrainReviewer/` — an LLM critic that pushes back on PR diffs (advisory).

**Enforcing (lives outside the agent):**
- `.github/workflows/boundaries.yml` — required check: boundaries.
- `.github/workflows/gates.yml` — required checks: verify + small-PR limit (stacked-PR proxy).
- `.github/workflows/review.yml` — advisory: posts the critic's findings.
- `BRANCH_PROTECTION.md` — the git-host settings + token scoping that make the above bind.

---

## 2. The three tiers of discipline (know which is which)

| Tier | What | Strength | Examples |
|------|------|----------|----------|
| **Surfaced** | Agent self-reports | only as strong as a human reading the reply | the cycle, TDD ordering, the "prove it" template |
| **Soft** | A second intelligence | stronger, still fallible/gameable | the LLM critic |
| **Hard** | Mechanical, unreachable by the agent | a guarantee | boundaries, small-PR limit, branch protection (+ coverage floor *once you arm it*) |

**Authority comes from a trust asymmetry, not from intelligence** — the hard tier
is dumb and unpersuadable on purpose, which is why no agent (not even a second
one) can be the hard tier. Full rationale in `README.md`.

---

## 3. Setup & the loops (pointers — not restated here, so they can't drift)

- **One-time setup (per repo):** `python bootstrap.py --protect`, then finish the
  residue it prints. The steps + the irreducible human parts live in the
  **README** quickstart and **`BRANCH_PROTECTION.md`**; the agent's executable
  first-run is **`START_HERE.md`**.
- **The per-task loop** is **`AGENTS.md`'s cycle** — the agent runs it; you just
  review PRs.
- **Building something new:** generator stamps the skeleton → wire **one vertical
  slice** end-to-end → then breadth as stacked small PRs (`AGENTS.md` +
  `…SoftwareArchitectureJudgmentRouter/rules/11`).

---

## 4. Daily commands

```bash
python bigbrain_verify.py                         # run the full cycle
python bigbrain_verify.py --only test             # one step
python bigbrain_verify.py --min-coverage 80       # enforce a coverage floor (TDD proxy)
python bigbrainBoundaryGuard/check_boundaries.py check     # boundaries only
python bigbrainBoundaryGuard/check_boundaries.py explain   # see the resolved policy
python bigbrainGenerator/new_domain.py <name> --allow platform   # new domain
git diff origin/main...HEAD | python bigbrainReviewer/review.py  # critic locally (needs API key)
```

---

## 5. The one thing to remember

Everything the agent *says* it did is surfaced — trust it for low stakes, verify
for the rest. Three things are guaranteed out of the box — **boundaries, small
PRs, branch protection** — and a coverage floor joins them once you arm it
(`MIN_COVERAGE`). The human at the top is irreducible not because automation fell
short, but because enforcement is the one job that must belong to an actor the
agent cannot reach.
