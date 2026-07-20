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
