# ADR 0001 — boundaries.yaml declares live modules only

- **Status:** accepted (PR #1)
- **Force (present-day):** `check_boundaries.py doctor` fails any module whose
  path contains no source files, and warns that a check over empty paths passes
  only vacuously. With all 13 target modules pre-declared before any code
  existed, the `boundaries` gate was permanently red-or-meaningless.

## Decision

`boundaries.yaml` declares **only modules whose folders exist** (today: `app`,
`shared_kernel`). The full target map — every planned module, its path, purpose
and allowed dependencies — lives in **`docs/ARCHITECTURE.md`** (single home;
the auditor reads it first). Each slice that stamps a module with
`bigbrainGenerator/new_domain.py` also re-declares it in `boundaries.yaml`
with its allow-list copied **exactly** from ARCHITECTURE.md's Depends-on column.

## Consequences (including the honest cost)

- Enforcement of existing code is real, never vacuous.
- **Cost:** rules for not-yet-built modules are advisory until re-declared.
  Under-granting is fail-closed (build breaks, builder notices). **Over-granting
  is not mechanically caught** — so PR review of any slice that touches
  `boundaries.yaml` MUST diff the new allow-list against ARCHITECTURE.md, and
  the auditor is asked to verify exactly this at every slice review.
- `new_domain.py` registers the module but does not populate its allow-list;
  that copy is manual and is the likeliest drift point — hence the rule above.
- Standing commitment (from auditor review of PR #1): the Foundation slice
  ships the SPEC §10.1 cross-tenant RLS must-fail test **in the same PR** as
  the first Prisma schema, not after.
