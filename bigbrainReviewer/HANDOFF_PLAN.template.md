# HANDOFF_PLAN.template.md — a plan an executor can run cold

Copy this per finding into `plans/NNN-<slug>.md` (create `plans/` if absent) —
**one slice per plan**, never the whole project at once. The auditor writes it;
the builder (or a cheaper executor agent) runs it. It must stand alone against the
*conversation*: the executor has **not** seen the audit, this repo's survey, or any
other plan, so "as discussed above" = broken; write the decision down here.
But reference the *codebase* by path: inline only the **minimal excerpt** a step
needs and point to files/specs by path for the executor to open on demand — don't
paste whole files, that just moves the context bloat downstream.

Read-only authorship: writing this plan is text only. The executor does the edits
under the normal `AGENTS.md` cycle, and the mechanical gates (boundaries, pr-size,
verify, coverage) decide the merge — this plan does not bypass any of them.

---

**Plan:** <one-line outcome>
**Written against commit:** <output of `git rev-parse --short HEAD`>   ← if HEAD has moved far past this, re-vet before trusting the excerpts below
**Why it matters:** <impact in 1–2 sentences — the cost of not doing it>

## Files
- **In scope (edit only these):** <exact paths>
- **Out of scope (look related, do NOT touch):** <exact paths + why>

## Current state (so the executor doesn't have to rediscover it)
```text
<short excerpt(s) you opened and confirmed yourself, file:line — leads are not facts>
```

## Convention to match
The repo does X this way; follow it. Exemplar to copy the shape of: `<path>`
```text
<short snippet of the existing pattern to imitate>
```

## Steps (ordered; each independently verifiable)
1. <explicit change>
   - verify: `<command>` → expect `<result>`
2. <next change>
   - verify: `<command>` → expect `<result>`
(One behavior at a time, TDD: failing test first → minimum code → refactor green.)

## Tests to add
- What: <behavior under test>  Where: `<test path>`  Pattern: follow `<existing test>`

## Done criteria (machine-checkable — commands + expected results, not prose)
- `python bigbrain_verify.py` → all steps green
- `python bigbrainBoundaryGuard/check_boundaries.py check` → passes (if structure touched)
- <any finding-specific check> → <expected output>

## Boundaries / escape hatches
- If the change needs a new cross-module import, STOP — that is a separate
  `boundaries.yaml` PR with an ADR naming the present-day force, not a quiet edit here.
- If <assumption in this plan> turns out false, STOP and report back instead of
  improvising — a wrong guess here is worse than a question.

## Maintenance note
What future work will touch this, and what a reviewer should watch for next time.
