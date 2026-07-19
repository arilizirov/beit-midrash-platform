# 04 Data Engineering Lifecycle

Use for ingestion, ETL/ELT, transformations, orchestration, batch/streaming/CDC, raw/staging/curated/serving layers, and DataOps.

Primary source: _Fundamentals of Data Engineering_  
Secondary sources: _Designing Data-Intensive Applications_, _DAMA-DMBOK_

## Core judgment

Design data systems lifecycle-first. Tools come after source behavior, consumer needs, quality, reliability, and governance are understood.

## Lifecycle

```text
generation
ingestion
raw storage
transformation
serving
consumption
monitoring
governance
retention/deletion
```

## Triggers

Apply when:

- building or changing pipelines
- ingesting files/APIs/databases/events
- choosing batch vs streaming vs CDC
- orchestrating jobs
- adding transformations
- supporting dashboards/data products/ML
- debugging stale/wrong data
- adding backfills/retries

## Rules

### Understand source systems first

Document:

```text
keys
updates
deletes
timestamps
pagination
rate limits
schema drift
consistency guarantees
source load impact
source owner
```

### Choose processing mode intentionally

Batch:

```text
simpler, cheaper, good for periodic analytics
```

CDC:

```text
captures database changes/deletes, useful for replication/history
```

Streaming:

```text
low latency, higher operational complexity
```

### Preserve raw when replay matters

Store raw/minimally transformed data when audit, debugging, reprocessing, or changing business rules matter.

### Layer transformations

Use logical layers:

```text
raw/staging
cleaned/intermediate
curated/marts
serving/semantic/data product
```

### Orchestrate beyond scheduling

Define:

```text
dependencies
retries
quality gates
backfills
state
alerts
freshness
run metadata
recovery
```

### Make jobs idempotent

Recurring pipelines must be safely rerunnable and backfillable.

Use:

```text
batch IDs
deterministic keys
watermarks/cursors
merge/upsert rules
partitioned processing
atomic publish
reconciliation
```

## Verification

Use:

- source connector tests
- schema drift tests
- update/delete tests
- raw load completeness tests
- transformation tests
- orchestration/DAG tests
- idempotency/rerun tests
- backfill tests
- freshness/lag tests
- reconciliation checks
- bad-row quarantine tests

## Anti-patterns

Do not:

- choose Kafka/Spark/lakehouse before requirements
- build streaming for weekly reports
- create cron chains with hidden dependencies
- append duplicates on rerun
- discard raw data when reprocessing matters
- hide transformation logic in dashboards
