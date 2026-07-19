# Data Architecture Review Checklist

Use this before finishing any significant data-related Codex task.

## Task classification

```text
[ ] Task type identified
[ ] Blast radius identified
[ ] Primary route selected
[ ] Secondary route selected if needed
[ ] Overengineering risk considered
```

## Conceptual model

```text
[ ] Real-world concept defined
[ ] Identity/key semantics clear
[ ] Roles separated from identity where needed
[ ] Relationships/cardinality clear
[ ] Time semantics clear
[ ] Missing/null meaning clear
[ ] Categories/statuses defined
[ ] Assumptions documented
```

## Operational schema

```text
[ ] Source of truth clear
[ ] Constraints appropriate
[ ] Migration handles existing data
[ ] Rollback or forward-fix considered
[ ] Indexes/access patterns considered
[ ] Public contract impact checked
```

## Analytics model

```text
[ ] Grain declared
[ ] Facts/dimensions separated
[ ] Measures classified by additivity
[ ] Conformed dimensions considered
[ ] Date/calendar logic centralized if needed
[ ] History/SCD strategy clear
[ ] Double-counting risk checked
```

## Pipeline

```text
[ ] Source semantics understood
[ ] Updates/deletes captured or consciously excluded
[ ] Batch/streaming/CDC justified
[ ] Raw data preserved if replay/audit matters
[ ] Transformations layered
[ ] Orchestration dependencies explicit
[ ] Idempotency/rerun safe
[ ] Backfill strategy clear
[ ] Freshness/lag monitored
```

## Quality and lineage

```text
[ ] Quality checks present
[ ] Source-to-target reconciliation present
[ ] Bad-row handling defined
[ ] Metadata/owner/source documented
[ ] Lineage/provenance available
[ ] Freshness visible to consumers
```

## Contracts and consumers

```text
[ ] Consumers identified
[ ] Compatibility checked
[ ] Versioning/deprecation needed?
[ ] Contract tests added/recommended
[ ] Semantic metric changes documented
```

## Security/privacy

```text
[ ] Sensitive fields identified
[ ] Least privilege applied
[ ] Logs safe
[ ] Masking/tokenization considered
[ ] Export controls considered
[ ] Retention/deletion considered
[ ] Downstream copies protected
```

## Verification

```text
[ ] Build/typecheck/compile where relevant
[ ] Unit tests
[ ] Migration tests
[ ] Data quality tests
[ ] Contract tests
[ ] Reconciliation tests
[ ] Performance/cost checks
[ ] Access-control checks
[ ] Manual smoke test if automated checks unavailable
```
