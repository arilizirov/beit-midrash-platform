# ADR 0004 — PRIVATE notes are enforced in RLS, not the guard layer

**Status:** accepted (2026-07-22) · **Amends:** SPEC §4 (Note: "enforced in guard layer")

## Force
SPEC §6 states the rule without qualification: a PRIVATE note is author-only
for **everyone**, the group owner included, and §10.2 makes it a launch gate.

That shape does not fit `can()`. Every other rule in the RBAC table is a
capability a role either has or lacks, and admins/owners sit at the top of the
lattice. This one inverts it: no role unlocks it, and the owner — who can do
everything else — can do less here than the note's author. Modelling it as a
capability would mean writing a permission that must never be granted, and
trusting that no future `GRANTS` edit ever grants it.

It also fails in the wrong direction at the guard layer. Layer 2 protects a
*route*; the leak we care about is a *query*. A service that forgets one
`WHERE visibility = 'GROUP' OR authorId = me` clause returns other people's
private writing, and nothing goes red.

## Decision
Enforce it at layer 4, in the Postgres policy on `Note`:

```sql
USING ("groupId" = current_setting('app.group_id', true)
       AND ("visibility" = 'GROUP' OR "authorId" = current_setting('app.user_id', true)))
```

`withGroup` gained a `viewerId` option (ADR-adjacent change, F5a-1) that sets
`app.user_id` transaction-locally. An absent viewer becomes `""`, which matches
no cuid2 id, so the failure mode is "sees nothing" rather than "sees everything".

`NoteTag` carries the same predicate through an `EXISTS` subquery against
`Note`, which re-enters Note's own policy. A tenant-only policy there was
**verified to leak**: any member could list the join rows of another member's
private notes (learning that one exists and which tags it carries), and could
both tag and untag it. The composite FK does not prevent this — Postgres
validates foreign keys with row security OFF.

## Consequences
- **The invariant covers exactly two tables.** `Revision`, `Attachment`,
  `SourceCitation` and `InternalLink` are polymorphic and tenant-only. SPEC §4
  puts `NOTE` in all of their entity-type enums, and a Revision stores a **full
  content snapshot** (SPEC §7, "not diffs"). When notes become versioned or
  attachable, each of those tables needs its own answer; the strength of the
  policy here makes it easy to assume otherwise.
- **Group-wide flows must opt in explicitly.** `export` and `purge` run without
  a viewer, so they see no private notes at all. Today neither touches `Note`.
  Whoever adds it must decide: a group export containing every member's private
  notes would contradict §6, so the likely answer is to export only the actor's
  own — but it must be a decision, not a default.
- **Search inherits it only if it goes through `withGroup` with a viewer.**
  Search columns are generated in-table, so a `Note` search vector is covered by
  the same policy. A SearchService that forgets `viewerId` hides the searcher's
  own private notes: an under-return with no error. §10.2's search half is
  therefore NOT met by this ADR.
- **One transaction, one viewer.** A multi-author bulk write to `Note` — restore
  from export, an import, a backfill — cannot happen in a single transaction,
  because `WITH CHECK` requires the author to be the current viewer. This
  constrains §10.5 (restore verified).
- **Author laundering is still open.** A GROUP note is writable by any member,
  so one member can set `authorId` to themselves and then flip `visibility` to
  PRIVATE, permanently hiding it from its original author. Both writes satisfy
  the policy; RLS cannot see this as wrong. It belongs in `can()` when the notes
  service lands.

## Alternatives rejected
- **A `can()` capability.** Would have to be a permission that is never granted;
  one careless `GRANTS` edit re-opens it, and a forgotten `WHERE` bypasses it
  regardless.
- **Service-layer filtering only.** Correct until the first caller forgets. The
  same reasoning that put the canonical-summary rule in a partial unique index
  (ADR-adjacent, F4c) applies here, with a worse blast radius.

## Owner decision still open
`visibility` defaults to **PRIVATE**, which the spec does not specify. It is the
safe direction — a note that becomes group-visible by accident cannot be un-seen
— but it means quick-capture (`הערה`) and the topic notes tab default to writing
content the chevruta cannot see, in a product whose point is shared study.
Flagging rather than deciding.
