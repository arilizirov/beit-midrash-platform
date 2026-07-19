# AGENTS.md

Read this first, every task. It routes — it doesn't teach. Depth lives in the brains.

## The cycle (follow this order, every non-trivial task)
1. **Orient.** Read `docs/STACK.md` for current stack/conventions. Read the relevant brain for judgment.
2. **Plan — map, then slice.** For multi-part work, first sketch a one-page *whole-project map* (the components and how they connect — this is `docs/ARCHITECTURE.md`, one line per module), then plan only the **current vertical slice** in detail — one thin path through every layer. Never expand the whole project to full detail or full pseudocode up front: the back half goes stale before you reach it and it floods the context window. Show the plan, wait. One stage = one small PR (stack each on the previous branch, each independently green).
3. **Scaffold structure with the generator, never by hand.** New domain? `python bigbrainGenerator/new_domain.py <name>`. It stamps the horizontal skeleton (born correct, registered in `boundaries.yaml`, following the repo's folder convention from `boundaries.yaml`'s `layout:` — `domains` or `features`) — then you fill it **vertically**: one real end-to-end behavior before fleshing out any single layer. **Label it:** give each module a one-line purpose in `docs/ARCHITECTURE.md` AND a header docstring, map it to the spec, and keep these current — connections must match `boundaries.yaml`. This is the birds-eye map the auditor reads.
4. **TDD, one behavior at a time.** Failing test first (red) → minimum code (green) → refactor green.
5. **Verify before "done."** Run `python bigbrain_verify.py` (typecheck, lint, test, e2e, boundaries). All steps green or it isn't done. **A vertical slice isn't done until one real journey passes end-to-end** (`rules/12`; e2e runs once a Playwright config exists — see `bigbrainQA/`).
6. **Prove it** in your final reply (template below), then open the PR.
7. **Submit to review.** Fill the PR template (what built / skipped / why / spec ref). Invoke the **debt-hawk** subagent on the diff for debt; for non-trivial or structural changes also invoke the **auditor** subagent (reviews top-down against the map + spec and teaches in plain language). Address must-fix findings. (CI critic also runs if the API key is set.)

Steps 1–6 are *yours to follow* (surfaced). The repo also enforces a *mechanical* floor you cannot talk past: the boundary check, the small-PR limit, the dependency/secret audits, and branch protection. Don't try to route around them.

## Also, always
Preserve existing behavior unless a change was asked for; match surrounding code style; clear context between unrelated tasks.

## Context discipline (keep the working window small)
- **Reference by path; read on demand** — name the spec/file and open only the slice you need; don't paste whole specs or files into the chat. A path you can re-open beats a wall of text you must carry.
- **Map, then slice** — the whole project stays a one-page map (`docs/ARCHITECTURE.md`); only the current slice is ever held in full detail. Don't plan or pseudocode the whole project up front.
- **Heavy or whole-repo reading → the auditor subagent** (its context is separate, so a big survey there doesn't bloat the builder's window); route to **one brain** per task and never auto-load `sources/` — the router pulls only the few rules a task needs.
- **Query the graph before you scan** — if a `graphify-out/` graph exists, use `graphify query` / `path` / `explain` instead of reading files one by one; it's a richer, queryable `docs/ARCHITECTURE.md`. No graph → read by path; a raw text search (grep) is the last resort, not the first.

## TDD (default for any behavior change)
- Write a failing test **first**, run it, see it fail for the right reason (red).
- Write the **minimum** code to make it pass (green). Nothing more.
- Refactor with the test green. Never add behavior during a refactor.
- Loop one behavior at a time. Don't write five tests then five features.
- Exception: trivial non-behavioral edits (typo, comment, formatting, config rename) and throwaway spikes. If you skip TDD, **say so and say why** — don't skip silently.

## KISS (simplest thing that works)
Before writing code, stop at the FIRST rung that holds — never fall to a lower rung without naming why the one above didn't apply:
1. Does this need to exist at all? → no: skip it.
2. Does the standard library already do it? → use it.
3. Does a native platform feature cover it? → use it.
4. Does an already-installed dependency solve it? → use it.
5. Can it be one line? → make it one line.
6. Only then: write the minimum that works.
- Build the smallest solution that satisfies the request as it stands now.
- No abstraction, layer, interface, class, config flag, or dependency without a force that exists **today** — not one you imagine for later.
- Solve the problem in front of you, not the general case, unless the general case was asked for.
- If two designs work, ship the one with fewer moving parts. Boring beats clever.
- Lazy ≠ negligent. Never trade away these to be simpler: input validation at trust boundaries, error/data-loss handling, security, accessibility, or anything explicitly requested.
- When you deliberately take a simpler path and a real future force *might* later change that, drop a `YAGNI:` comment naming what you didn't build — e.g. `// YAGNI: native <input type=date>, not a date-picker dep — revisit if design needs locale control`. The debt report harvests these so a deliberate "later" doesn't silently become "never."

## Prove it (every code task, in your final reply)
- TDD: show the test, show it failing (red), then show it passing (green). If you can't run the checks, say what's unverified.
- KISS: state in one line what you deliberately did **not** build, and why the simpler choice is sufficient.
- Boundaries: if the change touches module structure, run `check_boundaries.py check` and show it passing. If you changed `boundaries.yaml`, link the ADR and name the force.
- This is so I can catch a skipped discipline even when I can't spot a bug myself.

## Stack (use stable command names — don't guess)
- One command for the whole cycle: `python bigbrain_verify.py` (runs typecheck + lint + test + boundaries).
- Web app → TypeScript: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Data/scripts → Python: `ruff check .`, `ruff format --check .`, `pytest`.
- Boundaries (any stack): `python bigbrainBoundaryGuard/check_boundaries.py check`.
- Run `bigbrain_verify.py` before done. If a step fails, say so — don't claim done.

## Teach me (I'm still learning — I can't always spot mistakes)
- Before I accept code: explain what it does, why, and what could go wrong. Plain language.
- When a check fails: tell me the mistake and how to avoid it next time, not just the fix.
- If you're unsure or guessing, say so out loud rather than sounding confident.

## Current facts vs timeless judgment
- The brains hold *timeless judgment* (it doesn't expire). `docs/STACK.md` holds *current decisions* (versions, libraries, conventions) — read it and keep it current.
- For genuinely time-sensitive facts (a library's current API, deprecations), **fetch live docs at task time** rather than trusting frozen text — book or STACK.md.
- SUPERVISION: when you fetch docs, NAME the source (URL + what you concluded) in your reply so I can sanity-check it. Fetched facts are proposals to verify, not ground truth.

## Route into the brains
- Schema, migration, analytics/reporting table, pipeline, identity, or sensitive data → **bigbrainDataArchitecture**.
- Refactor, legacy code w/o tests, public API/contract change, service/module boundary, distributed, production-readiness, performance, or large rewrite → **bigbrainSoftwareArchitecture**.
- (Both brains must be present in the repo for these to work.)

## Boundaries are mechanically enforced (you are an untrusted committer)
- Module boundaries live in `boundaries.yaml` and are enforced by a CI check (`bigbrainBoundaryGuard`) running on every PR, outside your sandbox. You cannot `--no-verify` it and you cannot merge a violation.
- Treat yourself as exactly that: an untrusted committer. Your saying "I respected the boundary" is **not** enforcement — the red build is. Run `check_boundaries.py check` before declaring done and fix the *design* when it fails, never the rule.
- Do NOT propose disabling, weakening, or bypassing the boundary check, branch protection, required reviews, or the agent's own permissions. If a boundary genuinely must change, that is a deliberate PR against `boundaries.yaml` with an ADR naming the present-day force — surfaced for human review, not worked around.

## Security reflexes (always)
- Auth/authz check on every endpoint.
- Never trust user input — validate at the boundary.
- No secrets in code.
- Parameterized queries only — never build SQL by string.
- Don't log sensitive data.

## When I say "write that down"
Put the lesson in the strongest surface that fits:
- objective → a test or script
- domain judgment → the relevant brain
- a habit → this file
Never a "lessons" file nothing reads.

## PROJECT-SPECIFIC — LearnTorah (בית המדרש הדיגיטלי)

**The build spec is [`docs/SPEC.md`](docs/SPEC.md) — it is the single source of
truth for WHAT to build.** This file governs HOW (the cycle, TDD, gates). If they
ever conflict on scope, SPEC.md wins; if they conflict on process, AGENTS.md wins.
Reference it by path and open only the section you need — never paste it whole.
(`docs/PLANNING.md` / `PLANNING.html` are the superseded planning dossier; SPEC.md
line 3 says do not build from them. Keep them for history only.)

- **Hebrew-first, RTL-native.** CSS logical properties only (`inline-start/end`);
  per-segment bidi isolation (`dir="auto"`) for mixed Hebrew/Latin/source refs.
  Never a translated skin over an English layout.
- **Tenancy is a wall, not a convention.** Every content row carries `groupId`;
  four fail-closed layers (SPEC §6) with **Postgres RLS mandatory**. A
  cross-tenant must-fail test is a launch gate — never weaken it to go green.
- **Never hard-delete.** Soft delete + Revision + ActivityLog from day 1; hard
  removal only through the audited purge flow.
- **PRIVATE Notes are author-only for everyone, including OWNER** — in UI *and*
  in search. Any new read path must inherit that filter.
- **No raw free-text source refs.** All ref entry goes through SourceRefService
  (SPEC §9).
- **Search generated columns must use the `IMMUTABLE` `bm_normalize()`** — never
  `unaccent()` (STABLE); it will not compile (SPEC §8).
- **Do not build the reserved-future entities** (VoiceRecording, Transcript,
  Embedding, SourceSheet, StudyCard, AIConversation/AIMessage) or any AI feature
  in the V1 critical path — `AIService` stays a stub seam.
- **V1 has no cuts** (SPEC §3): everything listed ships. Sequence the risk via
  the build order (Foundation → Core loop → Editor → Periphery); never quietly
  defer a feature out of V1 — that is a scope change for the owner to make.
- **Launch gates** live in SPEC §10. Treat them as the definition of done.
