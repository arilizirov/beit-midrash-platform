# ADR 0002 — Identity uniques bind ACTIVE rows only (partial unique indexes)

**Status:** accepted (owner-approved, 2026-07-20) · **Deviation from:** SPEC §4

## Force
SPEC §4 mandates soft-delete everywhere AND `@@unique([userId, groupId])` on
Membership. Together they deadlock a real journey: a member who leaves keeps a
soft-deleted row, and re-inviting them violates the absolute unique.

## Decision
Uniqueness constraints on identity-lifecycle tables bind the **active** row
only, via Postgres partial unique indexes (Prisma cannot declare these — they
live in migration `identity_schema`, noted in the schema):

- `Membership(userId, groupId) WHERE "deletedAt" IS NULL` — one active
  membership; soft-deleted rows are history and may repeat.
- `Invitation(groupId, email) WHERE "acceptedAt" IS NULL AND "deletedAt" IS
  NULL` — one pending invitation; accepted/deleted ones are history.
  **Expiry is NOT part of the predicate** (time-derived `expiresAt` cannot be
  indexed): an expired-but-unaccepted invite still holds the slot, and the
  re-invite service must SUPERSEDE it — soft-delete the old row, create the
  new one, in one transaction. (A status enum was considered; rejected for
  now — timestamps + supersede keep one source of truth for "accepted".)

## Consequences
- Leave → re-invite works; re-sending an invitation after acceptance works.
- `findUnique` on the compound key is gone — lookups must spell out
  `findFirst({ where: { …, deletedAt: null } })` explicitly. (The global
  soft-delete read filter is SPEC'd but NOT BUILT yet — until it lands in the
  F2 guard layer, nothing hides history rows for you.)
- Any future "unique per X" on a soft-deleted table must decide
  active-vs-forever explicitly; default to active-only per this ADR.
- Proven by `src/platform/tenancy/lifecycle.test.ts` (rejoin succeeds; double
  ACTIVE still rejected; pending-slot semantics).
