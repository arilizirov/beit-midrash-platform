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

## Known behavior, deliberately NOT changed
- `check_boundaries.py check` still fails hard on "no language detected" in CI —
  softening it would let a broken-detection repo pass green. The pre-commit
  guard (fix 6) handles the only legitimate no-language window.
- `doctor` still refuses modules whose paths match no files. Correct: declare
  live modules only; keep the target map in `docs/ARCHITECTURE.md` and
  re-declare per slice (see the LearnTorah ADR-0001 pattern).
