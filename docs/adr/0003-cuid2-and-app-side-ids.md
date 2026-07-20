# ADR 0003 — cuid2, generated app-side

**Status:** accepted (2026-07-20) · **Amends:** SPEC §4 ("cuid() everywhere"), docs/STACK.md

## Force
A row's slug embeds a prefix of its own id (`<idPrefix>-<hebrew-title>`), so the
id must exist **before** the insert. The alternative — insert a placeholder
slug, then update — makes every concurrent create in a group contend on the
same placeholder key of the partial unique index (found in review, F3c).

## Decision
1. Ids are generated in **app code** via `shared_kernel/ids.newId()`.
2. That generator is **cuid2** (`@paralleldrive/cuid2`) — cuid1 is deprecated
   upstream, and cuid2 is shorter and has better collision resistance.
3. The schema default becomes **`@default(cuid(2))` on every model**, so rows
   created without an explicit id (seed, tests, future features) get the SAME
   format. One convention, two entry points that agree — the drift where
   service rows were cuid2 and everything else cuid1 was itself a review
   finding.

## Consequences
- SPEC §4's "cuid()" now reads as "cuid, version 2".
- New dep `@paralleldrive/cuid2` (ESM-only, Node ≥20.19; we run 24).
- `idPrefix()` = last 6 chars: slug collisions are *rare, not impossible*, and
  there is no retry. If a slug P2002 ever appears, add a retry rather than
  silently lengthening the prefix.
- That a row's slug prefix matches its own id stays a convention, unenforced.
