# KIT_FIXES.md — v5.1 (2026-07-20)

Bugs found while deploying kit v5 to a real project (LearnTorah,
`arilizirov/beit-midrash-platform`, PR #1) and fixed at the source in this
version. Each entry: symptom → root cause → fix.

## 1. Pristine bootstrap failed the kit's own linter
- **Symptom:** fresh `bootstrap.py` → `skill_lint.py` immediately red:
  "docs/STACK.md contradicts AGENTS.md".
- **Root cause:** `docs/STACK.template.md` (copied verbatim to STACK.md)
  contained the phrase "hand-roll folders" — inside a warning *against*
  hand-rolling — and the linter's regex matched the words, not the intent.
- **Fix:** template reworded to carry no trigger phrasing (`docs/STACK.template.md`).

## 2. skill_lint anti-generator regex false-positived on unrelated prose
- **Symptom:** STACK.md flagged for the sentence "never a hand-rolled switch
  statement" (about a polymorphism helper, nothing to do with folders).
- **Root cause:** bare `hand-?roll` matched anywhere.
- **Fix:** regex now requires folder/scaffold context —
  `hand-?roll(ed|ing|s)? … (folders|domains|modules|structure|scaffold…|skeletons)` —
  explicit generator-bypass phrases kept (`bigbrainSkillCheck/skill_lint.py`).

## 3. CI workflows pinned node 20 → boundaries gate crashed at runtime
- **Symptom:** `boundaries` job red in CI while identical check passed locally.
- **Root cause:** workflows pinned `node-version: "20"` (EOL April 2026);
  dependency-cruiser 18 depends on `commander@15` which requires node >=22.12.
  npm only *warns* (EBADENGINE) then the tool crashes when run.
- **Fix:** `node-version: "24"` in `gates.yml`, `boundaries.yml`, `qa.yml` (×2).

## 4. gates.yml never installed pyyaml → kit's own tests red in TS repos
- **Symptom:** `verify` job failed at "Test the kit's own tools" (ImportError).
- **Root cause:** Python deps installed only `if [ -f pyproject.toml ]`, but the
  kit's tests/tools import `yaml` regardless of the app's stack.
- **Fix:** unconditional `pip install pyyaml` in the install step (`gates.yml`).

## 5. bootstrap --protect deadlocked solo owners
- **Symptom:** with `required_approving_review_count: 1`, a single-maintainer
  repo can never merge — GitHub forbids approving your own PR.
- **Fix:** default is now `0` with a comment saying to raise it once a second
  human reviewer exists (`bootstrap.py`).

## 6. Sample pre-commit hook bricked pre-scaffold repos
- **Symptom:** installing the hook before any app code exists blocks EVERY
  commit — `check_boundaries.py check` exits non-zero on "no language detected".
- **Fix:** hook skips (with a message) when neither `package.json` nor
  `pyproject.toml` exists; CI still enforces once code lands
  (`bigbrainBoundaryGuard/hooks/pre-commit.sample`).

## 7. pr-size gate was FAIL-OPEN (most serious)
- **Symptom:** every PR passed `pr-size` regardless of size. Real log from a
  deployment: `4268 (limit 400)` followed by `[: integer expression expected`
  — and a green check.
- **Root cause:** in the gate's awk, `{s+=$1+$2}` sat on its own line below the
  pattern. Awk grammar: a pattern with no same-line action default-PRINTS every
  matching line, and the orphaned brace block runs for EVERY line (exclusions
  ignored). `CHANGED` became a multiline blob; `[ "$CHANGED" -gt "$MAX" ]`
  errored; the `if` fell through to false; the step exited 0. The gate that
  forces small stacked PRs never fired once.
- **Fix:** brace joined to the pattern's last line (`... {s+=$1+$2}`), with a
  warning comment (`.github/workflows/gates.yml`).
- **Lesson:** a gate is only real if you have SEEN it fail. Falsify every gate
  once on purpose (oversized dummy PR, dropped RLS policy, etc.) before
  trusting its green.

## Known behavior, deliberately NOT changed
- `check_boundaries.py check` still fails hard on "no language detected" in CI —
  softening it would let a broken-detection repo pass green. The pre-commit
  guard (fix 6) handles the only legitimate no-language window.
- `doctor` still refuses modules whose paths match no files. Correct: declare
  live modules only; keep the target map in `docs/ARCHITECTURE.md` and
  re-declare per slice (see the LearnTorah ADR-0001 pattern).

# v5.2 (2026-07-21) — operating lessons

Not bugs: workflow changes earned in a real build (LearnTorah, ~20 gated PRs).

## 8. Review ran AFTER the PR was opened — a second CI cycle on every finding
- **Symptom:** the cycle said "prove it, open the PR" (step 6) and only then
  "submit to review" (step 7). Since reviewers found must-fix items on most
  slices, nearly every PR paid: open → CI → review → fix → re-push → CI again.
- **Fix:** review the WORKING diff before the PR exists (`AGENTS.md` step 6),
  open the PR only once findings are addressed and verify is green again.
- **Note:** this is ordering only — the review itself is unchanged, and it kept
  earning its cost (it caught a cross-tenant FK hole, PII in an unerasable
  audit log, and an arbitrary-tenant resolver in one build).

## 9. No feedback loop from repeat findings to mechanical checks
- **Symptom:** the same classes recurred across slices — unused public surface
  (3x), vacuous tests (3x), documented-but-unenforced invariants (2x) — each
  fixed by hand, never converted into a check.
- **Fix:** `AGENTS.md` now says: same class flagged twice ⇒ mechanize it (lint
  rule, test, generator change). A repeat finding is a missing check.

## 10. Reviewers had no standing test for VACUOUS proof
- **Symptom:** three green tests proved nothing — a "fails closed" test whose
  failure path could not fire (no FK existed, so the bad insert succeeded), a
  concurrency test using different inputs (passes under the very design it
  rules out), and an isolation test connected as a SUPERUSER (RLS never binds
  superusers). All were caught by luck, not by rubric.
- **Fix:** `REVIEWER.md` and `AUDITOR.md` now carry the standing question —
  *"would this still pass if the thing it tests were broken?"* — with the
  recurring shapes listed. Generalizes fix #7's lesson from gates to tests.

## 11. e2e could NEVER run on Windows (bare `npx`)
- **Symptom:** adopting Playwright, `bigbrain_verify.py --only e2e` printed
  "tool not found for 'e2e': npx" and failed — while `npx playwright test`
  worked fine from the shell.
- **Root cause:** the script already shims npm (`NPM = ["cmd","/c","npm"]` on
  Windows, because npm is a `.CMD` shim that `CreateProcess` cannot exec
  directly) but built the e2e step from a bare `["npx", ...]`. So the one
  gate at the top of the test pyramid was unreachable on Windows — and,
  because the kit ships e2e disabled until a config exists, nobody would hit
  it until the day they adopted Playwright.
- **Fix:** matching `NPX` shim, used for the e2e step (`bigbrain_verify.py`).

## 12. Next.js projects nested under a home dir with a stray lockfile serve a STALE build
- **Symptom:** not a kit bug, but a trap worth recording: sabotaging BOTH auth
  layers changed nothing observable, because the dev server never recompiled.
- **Root cause:** Next walks up for a workspace root, found a `package-lock.json`
  in the user's HOME, and watched that tree instead of the project's.
- **Fix:** pin `turbopack.root` in `next.config.ts`. Worth checking whenever
  "my edit had no effect" — and a reminder that a green suite against a stale
  server is the purest form of vacuous proof (see the REVIEWER/AUDITOR rule).

## Considered and REJECTED
- **Excluding `prisma/migrations/**` (or any migration dir) from the pr-size
  gate.** Tempting — generated DDL eats the budget. But migrations are exactly
  where hand-written security SQL lives (RLS policies, partial uniques,
  composite tenant FKs); excluding them would drop the most sensitive code in
  the repo out of the size discipline. Schema slices are simply numerous. The
  gate was right; the plan bends to the gate.
