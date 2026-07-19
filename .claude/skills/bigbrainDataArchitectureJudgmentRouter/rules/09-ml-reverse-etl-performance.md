# 09 ML, Reverse ETL, Performance, and Cost

Use for ML feature pipelines, advanced analytics, reverse ETL, operational analytics, cost/performance optimization, and large-scale data workloads.

Primary source: _Fundamentals of Data Engineering_  
Secondary sources: _Designing Data-Intensive Applications_, _DAMA-DMBOK_, _Data and Reality_

## ML / advanced analytics

### Core judgment

ML data requires point-in-time correctness, leakage prevention, reproducibility, and training-serving consistency.

### Rules

- Include event time and feature timestamp.
- Join features as-of prediction time.
- Separate labels from features.
- Version training datasets.
- Preserve feature lineage.
- Test training-serving consistency.
- Avoid future aggregates.

### Verification

- point-in-time join tests
- leakage tests
- training-serving skew tests
- feature freshness tests
- reproducibility tests
- dataset version tests

## Reverse ETL / operational analytics

### Core judgment

Do not let derived/stale analytics silently become operational truth.

### Rules

- Label analytical outputs as derived.
- Preserve operational source-of-truth boundaries.
- Include freshness/as-of metadata.
- Make syncs idempotent.
- Audit writes back to operational systems.
- Define correction and rollback path.
- Avoid circular data flows.

### Verification

- target contract tests
- idempotent sync tests
- freshness tests
- audit log tests
- rollback tests
- circular dependency checks

## Performance and cost

### Core judgment

Data systems must be designed for workload and cost model.

### Rules

- Partition large analytical tables by common filters/date.
- Cluster/index by common join/filter keys.
- Prefer incremental processing over full refresh when appropriate.
- Use governed aggregates/materialized views for common dashboards.
- Reconcile aggregates to detail.
- Monitor query/job cost and runtime.
- Archive cold data.
- Avoid accidental unbounded scans.

### Verification

- query performance tests
- explain-plan review
- partition pruning checks
- incremental processing tests
- job duration/cost monitoring
- dashboard load tests
- aggregate reconciliation tests

## Anti-patterns

Do not:

- use future information in ML features
- overwrite operational truth with warehouse-derived values
- run full-history refreshes by habit
- create expensive real-time systems for slow business needs
- optimize tiny data prematurely while ignoring obvious future scale risks
