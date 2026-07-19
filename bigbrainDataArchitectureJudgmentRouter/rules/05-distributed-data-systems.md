# 05 Distributed Data Systems

Use for distributed storage, transactions, replication, consistency, partitioning, event logs, streams, caches, queues, derived data, and failure-aware design.

Primary source: _Designing Data-Intensive Applications_

## Core judgment

Distributed data systems fail in partial, delayed, duplicated, reordered, and inconsistent ways. Make the tradeoffs explicit.

## Triggers

Apply when:

- using multiple databases/services
- adding queues/events/streams
- building caches/materialized views/read models
- changing transactions or isolation
- using replication/partitioning
- processing retries
- deriving data asynchronously
- handling eventual consistency
- designing outbox/inbox/event log flows

## Rules

### State consistency model

Clarify:

```text
strong consistency
eventual consistency
read-your-writes
causal expectations
staleness tolerance
```

### Handle retries and idempotency

All distributed side effects need idempotency or deduplication strategy.

### Treat derived data as derived

Materialized views, caches, search indexes, projections, and analytics tables must be rebuildable/reconcilable from source.

### Design for ordering and duplicates

Events/streams may be:

```text
duplicated
out of order
late
missing temporarily
replayed
```

### Avoid distributed transactions unless justified

Prefer clear ownership and asynchronous workflows when possible, but do not hide consistency needs.

### Track backpressure and resource limits

Streaming/queue systems need lag, retry, dead-letter, and alert strategies.

## Verification

Use:

- idempotency tests
- duplicate/out-of-order event tests
- replay tests
- consistency/staleness tests
- cache/index rebuild tests
- projection reconciliation
- failure/retry tests
- transaction isolation tests where relevant
- lag/backpressure monitoring

## Anti-patterns

Do not:

- assume event delivery exactly once unless infrastructure and logic prove it
- treat caches/search indexes as source of truth
- ignore stale reads in user workflows
- create distributed workflows without recovery states
- split data ownership without consistency design
