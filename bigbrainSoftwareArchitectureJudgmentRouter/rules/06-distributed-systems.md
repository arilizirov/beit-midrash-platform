# 06 Distributed and Data-Intensive Systems

Use for distributed workflows, databases, queues, events, caches, replication, partitions, consistency, and derived data.

Primary source: _Designing Data-Intensive Applications_
Secondary sources: _Release It!_, _Software Architecture: The Hard Parts_

## Core judgment

Distributed systems are not local function calls. Expect partial failure, delay, duplication, reordering, stale reads, and conflicting views of truth.

## Triggers

- multiple services/databases
- event-driven design
- async workflows
- queues/streams
- cache/read model/materialized view
- replication/partitioning
- distributed transactions
- consistency decisions
- retry/replay
- outbox/inbox

## Rules

- State consistency expectations: strong, eventual, read-your-writes, causal, or bounded staleness.
- Make data ownership explicit.
- Events, commands, and external side effects need idempotency/deduplication.
- Handle out-of-order, duplicate, late, and replayed messages.
- Caches, search indexes, projections, and read models must be rebuildable/reconcilable from source.
- Avoid distributed transactions unless justified; consider single owner, outbox, saga/process manager, compensation, or two-phase commit only when warranted.

## Verification

- idempotency tests
- duplicate/out-of-order event tests
- replay tests
- consistency/staleness tests
- projection rebuild tests
- source-vs-derived reconciliation
- failure/retry tests
- contract tests between services

## Anti-patterns

Do not assume exactly-once delivery unless proven end-to-end, use cache/search/read model as source of truth, split services sharing the same transaction boundary without a plan, or hide distributed workflow state in logs only.
