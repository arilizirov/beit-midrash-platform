# BACKLOG — status & known limits

## Delivered this pass (optional Graphify integration)

- **Auto-use, never auto-install.** A new Context-discipline rule: if a
  `graphify-out/` graph exists, agents query it (`graphify query`/`path`/`explain`)
  before scanning files — grep is now explicitly the last resort. The auditor's
  map-reading points at the graph when present. `START_HERE` adds an *optional*
  setup note: use Graphify if installed, otherwise **offer it to the human and
  wait** (`uv tool install graphifyy`) — the agent does not install tools or
  reconfigure its own environment, same principle as the gates.
- **No dependency added; nothing removed.** `docs/ARCHITECTURE.md` stays the
  zero-dependency default and the source of *intent*; Graphify is a faster
  *navigation* layer on top, used only if the human has installed it. The kit
  never mandated grep, so nothing was deleted — grep stays as a fallback, just
  ranked last. Caveat: Graphify shares the hand map's drift problem (needs
  `--update`), so it doesn't solve staleness, only makes the richer map cheaper.

## Delivered this pass (lighter kit + context discipline + release packaging)

- **Trimmed the always-read tax.** `AGENTS.md` 1,420 → ~1,250 words: cut the
  "Discipline gates" section (it only restated TDD/KISS/Boundaries) and condensed
  "Habits". Folded "Stacked PRs" into the cycle's Plan step.
- **De-duplicated the human docs** (each now has one job, cross-referenced —
  `START_HERE` 884 → ~500, `OPERATING` 911 → ~590). The 7-step loop lives only in
  `AGENTS.md` now, so the docs can't drift. `START_HERE` was slimmed, not deleted
  (skill-lint requires it).
- **Context discipline** is now explicit: a `## Context discipline` section in
  `AGENTS.md` (reference by path / read on demand; map-then-slice; heavy reading →
  the auditor's separate context; one brain per task; never auto-load `sources/`).
  Cycle step 2 is now "map, then slice" — no whole-project pseudocode up front.
  `HANDOFF_PLAN.template` references the codebase by path with minimal excerpts;
  `AUDITOR.md` returns a compact table + `file:line` refs, never file dumps.
- **Release packaging** (`build_release.py`): emits `dist/bigbrain-agent-kit-full.zip`
  and a lean `…-core.zip` (brains' `sources/` notes stripped + manifests cleaned so
  core still passes skill-lint). `sources/` is never loaded into context, so core is
  behaviourally identical — only ~13 KB smaller, i.e. a publish nicety, not a real
  size win. `dist/` is gitignored.

Left intact on purpose: the brains' `sources/` (provenance/credibility, zero
context cost) and the rest of `AGENTS.md` (TDD/Boundaries/Stack depth earns its
place — cutting it weakens discipline, not bloat). skill-lint green, 25/25 tests.

## Delivered this pass (sharper KISS + audit/handoff front-end)

Folded the useful ideas from two external skills into the kit *as text* — no new
top-level package, no second toolchain.

- **KISS is now a procedure, not just a value.** `AGENTS.md` carries a 6-rung
  "stop at the first rung that holds" ladder (exist? → stdlib → native → installed
  dep → one line → minimum), plus an explicit lazy-≠-negligent carve-out
  (validation, data-loss, security, accessibility, anything requested are never cut).
- **`YAGNI:` simplification marker** — one token added to the existing debt
  harvester (`bigbrainQA/debt_report.py`), not a new vocabulary. The agent flags a
  deliberate simpler choice inline; the debt report surfaces it so "later" doesn't
  become "never." New test in `tests/test_debt_report.py` (now 25 tool tests).
- **Reviewer emits a DELETE / SIMPLIFY list.** `REVIEWER.md` (the debt hawk) now
  checks each addition against the ladder and outputs what to remove + the leaner
  replacement. One persona, no new subagent — the existing `debt-hawk` subagent
  reads it unchanged.
- **Auditor gained an audit→handoff front-end.** `AUDITOR.md` retro-audit now
  scopes to a named area *or* the whole repo, emits a leverage-ranked findings
  table, vets every cited finding in the real code before reporting, and can write
  a self-contained, commit-stamped handoff plan via the new
  `bigbrainReviewer/HANDOFF_PLAN.template.md` — written for an executor with zero
  context (feeds the AGENTS.md cycle and the mechanical gates; never bypasses them).

skill-lint green, 25/25 tool tests. The `.claude/agents/*` subagent files and
`bootstrap.py` were intentionally left untouched (skill-lint keeps them
byte-identical), so all new behavior lives in the personas they already read.

## Delivered this pass

**Audit fixes (all resolved):**
- A. Copyright — full-text book extractions removed; replaced with original
  principle notes (~850 KB → ~80 KB). skill-lint now guards against regression.
- B. Coverage gate measured nothing — `bigbrain_verify.py` now points `--cov` at
  a real source (manifest → src/ → cwd).
- C. Vacuous boundary pass — `check_boundaries.py doctor` fails if a module maps
  to zero files; wired into CI and START_HERE.
- D. Instruction files now CODEOWNERS-guarded (AGENTS/CLAUDE/START_HERE, workflows).
- E. The kit's own tools now have tests (`tests/`, 19 tests) + a zero-dep runner.
- F. Windows: cross-platform `.pre-commit-config.sample.yaml` + Git Bash note.
- G. "No PRs = no enforcement" warning added (README).
- H. PR-size gate now excludes lockfiles/generated/vendored paths.
- M. Generator detects jest vs vitest and tolerates commented anchor lines.

**E2E / QA layer (was deferred item 1):**
- `rules/12-e2e-and-qa.md` + router route L + manifest updated.
- e2e step in `bigbrain_verify.py` (Playwright, auto-detected; no-op until adopted).
- `bigbrainQA/`: smoke.sample.py (post-deploy), playwright config + example spec.
- `.github/workflows/qa.yml`: e2e + dependency audit (npm/pip-audit) + secret scan.

**Layout consistency (STACK vs generator):**
- Generator is now layout-aware (`domains`/`features`) driven by
  `boundaries.yaml`'s `layout:` key (single source of truth); `--layout` flag too.
- `AGENTS.md`, `STACK.template.md`, and the boundaries sample aligned to it.
- skill-lint now FAILS if `docs/STACK.md` contradicts the generator principle.

**Skill-checking system (3 layers):**
- `bigbrainSkillCheck/skill_lint.py` — HARD: skills well-formed & consistent (CI).
- `tests/` behavioral test — HARD: generated rules would catch a real violation.
- `bigbrainEval/` — SOFT: measures whether a skill changes agent behavior (opt-in).

**Tech-debt visibility (soft tier — never gates):**
- `bigbrainQA/debt_report.py` surfaces churn / big files / hot-and-big /
  markers (analyzes app code, skips the kit); non-blocking `debt-report` job in qa.yml.
- `bigbrainReviewer/REVIEWER.md` sharpened into a debt hawk ("passes checks; what will we regret?").
- Honest by design: debt has no checkable definition, so these make it visible, not enforced.

## Remaining / known limits (documented, not bugs)
- I. Workflows are GitHub Actions; other hosts need the jobs ported (noted in
  BRANCH_PROTECTION.md). Python tools are host-agnostic.
- J. One `source_root` per manifest; polyglot monorepo = one manifest per app.
- K. Python public-surface enforcement needs the `_internal/` convention with
  import-linter; tach does it natively.
- L. BoundaryGuard enforces data *code*, not data *artifacts* (table/schema
  ownership stays a surfaced discipline via the data brain).
- Eval harness is statistical + needs an API key; run periodically, never a gate.

## Not started (optional future)
- Executor-dispatch loop (auditor writes a plan → a cheaper executor agent runs it
  in an isolated git worktree → auditor reviews the diff and verdicts). Deferred:
  high complexity, needs a host that can spawn subagents in a worktree, and only
  pays off once a cheaper-model executor is actually in the loop. The handoff plan
  template above is the half that's worth having now.
- Accessibility/performance gates (axe/Lighthouse with thresholds) — hooks noted
  in rules/12, not wired.
- Mutation testing (stronger-than-coverage TDD proxy) — mentioned, not wired.
