# 02 Operational vs Analytical Data

Use when deciding whether data belongs in application OLTP schema, read model, warehouse, mart, report table, materialized view, or dashboard model.

Primary sources: _Building the Data Warehouse_, _Fundamentals of Data Engineering_, _The Data Warehouse Toolkit_

## Core judgment

Operational systems and analytical systems have different jobs. Do not force one model to serve both badly.

## Operational data

Optimized for:

```text
transactional correctness
current state
workflow execution
constraints
small reads/writes
high concurrency
source of truth
```

## Analytical data

Optimized for:

```text
historical trends
large scans
decision support
cross-domain analysis
facts/dimensions
metrics
read-heavy workloads
derived/served models
```

## Triggers

Apply when:

- dashboard queries production OLTP tables directly
- reports slow down app workflows
- reporting needs history but operational tables store current state
- business users join many normalized tables
- analytical logic is embedded in app controllers
- source schemas leak into BI

## Rules

- Keep operational source of truth clear.
- Use read models/materialized views/marts/warehouse layers for heavy recurring analytics.
- Do not copy OLTP schema as final analytics model.
- Analytical models should be derived and freshness-labeled.
- Use operational DB for transactions, not long-running decision-support scans.
- Use analytics structures for history, metrics, and cross-domain analysis.

## Verification

Use:

- performance checks for operational workload
- dashboard query tests against analytical model
- freshness checks
- source-to-derived reconciliation
- migration/compatibility tests
- user-facing metric validation

## Anti-patterns

Do not:

- run large BI scans on production transaction tables by default
- use warehouse tables as operational source of truth without explicit write-back design
- hide reporting transformations in dashboards
