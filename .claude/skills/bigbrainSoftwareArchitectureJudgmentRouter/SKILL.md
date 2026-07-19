---
name: bigbrainSoftwareArchitectureJudgmentRouter
description: Judgment-router skill pack for Codex. Use when a task involves software architecture, refactoring, legacy code, tests, production readiness, distributed systems, maintainability, API/schema contracts, performance, reliability, senior engineering tradeoffs, or feature/bug work with non-trivial blast radius. Routes Codex to relevant book-derived senior-engineering judgment without overengineering.
---

# bigbrainSoftwareArchitectureJudgmentRouter

This is a judgment-router skill pack, not a book-summary skill.

It makes Codex behave more like a senior software engineer by:

1. classifying the engineering task
2. detecting architectural and delivery risk
3. selecting the relevant source-derived judgment
4. applying only the necessary rules
5. making the smallest safe change
6. verifying the result
7. avoiding overengineering and broad rewrites

## Sources (original notes)

Short original principle notes (paraphrase, not book text), designed around:

1. _Clean Code_
2. _Refactoring_
3. _Working Effectively with Legacy Code_
4. _Release It!_
5. _Designing Data-Intensive Applications_
6. _Software Architecture: The Hard Parts_
7. _Growing Object-Oriented Software, Guided by Tests_
8. _An Elegant Puzzle_

Do not read all sources by default. Use the router first.

---

# Core operating rule

Before writing or changing code:

```text
Classify → Route → Change Safely → Verify → Report
```

## 1. Classify

Classify the task as one or more:

```text
small feature
bug fix
refactor
legacy-code change
test improvement
API/contract change
database/schema/data-contract change
architecture decision
module/service boundary change
distributed-system change
production-readiness/reliability change
performance/scalability change
security/privacy-sensitive change
large cleanup/rewrite request
engineering-management/sequencing decision
```

## 2. Identify blast radius

Classify blast radius:

```text
local/private function
class/module
public API
database/schema
data contract/event/file format
cross-module dependency
cross-service boundary
production/runtime behavior
security-sensitive path
user-facing workflow
team/process/roadmap decision
```

## 3. Route

Use:

```text
router/00-judgment-router.md
```

Then consult only the relevant rule file/source.

## 4. Change safely

Default behavior:

```text
prefer the smallest safe change
preserve existing behavior unless explicit behavior change is requested
separate refactoring from behavior change
avoid broad rewrites
avoid premature abstractions
avoid tool/pattern-first design
add or adjust tests/checks that prove the change
state tradeoffs for architecture decisions
```

## 5. Verify

Use the most relevant proof:

```text
build/typecheck
unit tests
characterization tests
integration tests
contract tests
migration tests
load/performance checks
fault/retry checks
security/privacy checks
manual smoke test
```

If verification cannot be run, state what remains unverified.

---

# Always-on senior engineering checks

Use these for any non-trivial task:

```text
Intent: What behavior, design quality, or risk is this change meant to improve?
TDD: Is there a failing test for this behavior before the implementation exists?
KISS: Is this the simplest design that satisfies the current request? What am I NOT building?
Safety: What must not break?
Blast radius: Is this local, public, persistent, distributed, user-facing, or production-critical?
Tests: What test or check proves the change?
Contracts: Does this change a public API, schema, event, config, CLI, file format, or persisted behavior?
Coupling: Does this create hidden coupling, circular dependencies, or unclear ownership?
Runtime: What happens under failure, timeout, retry, load, partial outage, or bad input?
Maintainability: Is the code clearer after the change, or only different?
Overengineering: Is a new abstraction/service/framework/pattern justified by current forces?
```

---

# High-risk triggers

## Legacy code without tests

Route to legacy-code rules. Add characterization tests or safety seams before changing behavior.

## Refactor request

Route to refactoring rules. Separate behavior-preserving cleanup from feature/bug behavior change.

## Public contract change

Route to contract rules. Check compatibility, consumers, versioning, migration, and tests.

## Architecture decision

Route to architecture tradeoff rules. State forces, tradeoffs, coupling, data ownership, deployability, operability, and what is intentionally deferred.

## Distributed/system boundary change

Route to distributed-systems rules. Check consistency, idempotency, retries, ordering, failure modes, observability, and data ownership.

## Production-facing code

Route to production-readiness rules. Check timeouts, retries, fallbacks, resource limits, observability, backpressure, and recovery.

## Test design

Route to testing/GOOS rules. Prefer tests that verify behavior through stable interfaces and guide design without over-mocking.

## Large rewrite

Route to safe-change + architecture rules. Challenge rewrite scope. Prefer strangler/slice-by-slice migration unless rewrite is explicitly justified.

---

# Anti-patterns

Do not:

```text
write implementation code before a failing test exists for the behavior (outside the stated TDD exceptions)
add abstractions, layers, services, or dependencies before a present-day force justifies them
rewrite broad areas casually
mix refactoring with behavior change without saying so
mechanically update tests without understanding whether behavior changed
add abstractions before duplication/variation forces justify them
create interfaces/classes/services only because patterns say so
split services without data ownership, transaction, deployment, and operational boundaries
ignore timeout/retry/failure behavior in production paths
treat distributed systems like local function calls
break public contracts without migration/versioning
optimize performance blindly without measurement
delete ugly legacy code without first protecting current behavior
choose trendy architecture/tooling instead of the simplest sufficient design
```

---

# Progressive disclosure

Use files in this order:

1. `SKILL.md`
2. `router/00-judgment-router.md`
3. relevant `rules/*.md`
4. relevant source extraction in `sources/*.md`
5. relevant checklist in `checklists/*.md`

Do not read all source files unless explicitly asked to synthesize the whole pack.

---

# Minimal final response template

```text
Task type:
Route used:
Decision/change:
TDD evidence: test written first → red (failed for the right reason) → green. (Or: TDD exception + reason.)
KISS note: what I deliberately did NOT build, and why the simpler choice suffices.
Verification:
Risks/follow-up:
```

Keep it concise unless the user asks for a full architecture review.
