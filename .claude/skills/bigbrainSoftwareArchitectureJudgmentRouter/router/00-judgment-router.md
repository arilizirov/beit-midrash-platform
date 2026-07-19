# 00-judgment-router.md

This file routes Codex from a software task to the relevant senior-engineering judgment.

Do not read all source files. Use this router to select only what matters.

---

# Route map

## A. Local code clarity / maintainability

Use when code is hard to read, naming is unclear, functions/classes are too large, conditionals are tangled, duplication exists, or the user asks for cleanup.

Primary source: `Clean Code`
Secondary sources: `Refactoring`, `GOOS`
Rules: `rules/01-clean-code-local-design.md`, `rules/02-refactoring-safe-change.md`

Main judgment: Improve clarity through names, small cohesive units, reduced duplication, and explicit intent. Do not make code clever; make behavior easier to see and change.

---

## B. Refactoring

Use when behavior should stay the same while structure/design improves.

Primary source: `Refactoring`
Secondary sources: `Clean Code`, `Working Effectively with Legacy Code`, `GOOS`
Rules: `rules/02-refactoring-safe-change.md`, `rules/03-legacy-code-change.md`

Main judgment: Refactor in small behavior-preserving steps, with tests or characterization coverage, and separate cleanup from behavior change.

---

## C. Legacy code change

Use when code lacks tests, behavior is poorly understood, coupling is hidden, or regression risk is high.

Primary source: `Working Effectively with Legacy Code`
Secondary sources: `Refactoring`, `GOOS`, `Clean Code`
Rules: `rules/03-legacy-code-change.md`, `rules/02-refactoring-safe-change.md`, `rules/04-testing-and-goos.md`

Main judgment: Before changing risky legacy behavior, create safety: characterize current behavior, add seams, make small changes, and preserve behavior unless intentionally changing it.

---

## D. Testing / test-guided design

Use when adding tests, dealing with brittle tests, over-mocking, hard-to-test design, or TDD-style implementation.

Primary source: `Growing Object-Oriented Software, Guided by Tests`
Secondary sources: `Working Effectively with Legacy Code`, `Refactoring`
Rules: `rules/04-testing-and-goos.md`

Main judgment: Use tests to verify behavior through stable interfaces and guide clean object boundaries. Avoid tests that merely lock implementation details.

---

## E. Production readiness / reliability

Use for production-facing code, APIs, network/database calls, retries, timeouts, resource usage, outages, scaling, and runtime risk.

Primary source: `Release It!`
Secondary sources: `DDIA`, `Software Architecture: The Hard Parts`
Rules: `rules/05-production-readiness.md`, `rules/06-distributed-systems.md`

Main judgment: Design for real production failure: timeouts, retries, backpressure, resource limits, isolation, observability, recovery, and graceful degradation.

---

## F. Distributed/data-intensive systems

Use for replication, partitions, queues, streams, caches, consistency, transactions, event-driven workflows, derived data, idempotency, ordering, and replay.

Primary source: `Designing Data-Intensive Applications`
Secondary sources: `Release It!`, `Software Architecture: The Hard Parts`
Rules: `rules/06-distributed-systems.md`, `rules/05-production-readiness.md`

Main judgment: Make consistency, ordering, idempotency, failure, replay, partitioning, and derived-data correctness explicit. Distributed systems are not local function calls.

---

## G. Architecture tradeoff / hard parts

Use when changing boundaries, choosing monolith vs services, evaluating module/service splits, or making a tradeoff with no perfect answer.

Primary source: `Software Architecture: The Hard Parts`
Secondary sources: `An Elegant Puzzle`, `DDIA`, `Release It!`
Rules: `rules/07-architecture-tradeoffs.md`, `rules/06-distributed-systems.md`, `rules/05-production-readiness.md`

Main judgment: Architecture is tradeoff analysis under constraints. Identify forces, coupling, deployability, data ownership, transactions, operational cost, team boundaries, and what is deferred.

---

## H. Engineering sequencing / senior judgment

Use when deciding what to do next, prioritizing roadmap/tech debt/refactor/rewrite, or sequencing architecture work.

Primary source: `An Elegant Puzzle`
Secondary sources: `Software Architecture: The Hard Parts`, `Release It!`
Rules: `rules/08-engineering-sequencing.md`, `rules/07-architecture-tradeoffs.md`

Main judgment: Sequence work by risk, leverage, learning, and team capacity. Do the smallest high-leverage step that improves future options.

---

## I. Public contracts / migrations

Use when changing public APIs, persisted schemas, events, config/CLI behavior, file formats, or external integrations.

Primary sources: `Refactoring`, `DDIA`, `Release It!`
Rules: `rules/09-contracts-and-migration-safety.md`

Main judgment: Shared contracts require compatibility, migration, versioning, consumer awareness, rollback/forward-fix, and tests.

---

## J. Performance/scalability

Use for slow code/query/API, scaling concerns, resource exhaustion, caching, batching, concurrency, or performance-sensitive paths.

Primary sources: `Release It!`, `DDIA`
Rules: `rules/10-performance-and-scalability.md`

Main judgment: Measure first when possible. Optimize the bottleneck. Protect production with limits, backpressure, coherent caching, and regression checks.

---

## K. New feature / system — delivery order

Use when building something NEW (feature, module, app, service) or right after the generator stamps a domain skeleton: decide the *order* you build, not the arrangement.

Primary source: `Growing Object-Oriented Software, Guided by Tests`
Secondary source: `An Elegant Puzzle`
Rules: `rules/11-vertical-slices.md`

Main judgment: Build one thin path through every layer first (real UI/service/DB/test/deploy), prove the shape end to end, then add breadth. Front-load integration risk; don't scaffold breadth before one slice works. A horizontal-scoped goal is still delivered as vertical slices.

---

## L. End-to-end / QA — verifying the built thing

Use when a feature/slice is built and you need to confirm the assembled, running system works; pre-deploy verification; "QA"/"test the whole flow"; recurring prod incidents units missed.

Primary source: `Growing Object-Oriented Software, Guided by Tests`
Secondary sources: `Release It`
Rules: `rules/12-e2e-and-qa.md`

Main judgment: Keep e2e thin (a few critical journeys). A slice isn't done until one journey passes end to end against the running system. Smoke-test after deploy. Wire dependency/secret audits as cheap mechanical gates.

---

# Internal routing output

Codex should decide:

```text
Task type:
Blast radius:
Primary route:
Secondary route:
Triggered rules:
Verification needed:
Overengineering risk:
```

Do not expose the full internal route unless useful to the user.
