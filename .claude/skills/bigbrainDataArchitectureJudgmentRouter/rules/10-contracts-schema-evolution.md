# 10 Contracts, Schema Evolution, and Migration Safety

Use when changing public/shared schemas, APIs, events, files, warehouse tables, data products, semantic models, migrations, or dashboards consumed by others.

Primary sources: _Fundamentals of Data Engineering_, _Data Mesh_, _DAMA-DMBOK_, _Designing Data-Intensive Applications_

## Core judgment

Shared data schemas are contracts. Changing them requires compatibility, migration, testing, and consumer awareness.

## Triggers

Apply when changing:

```text
database schema
API payload
event schema
CSV/file format
warehouse table
semantic model
dashboard source model
data product contract
metric definition
reference values
```

## Rules

### Identify consumers

Know what systems, dashboards, ML jobs, reports, APIs, or teams consume this data.

### Prefer additive changes

Add new fields first. Keep old fields during migration when possible.

### Version breaking changes

Breaking changes need:

```text
version bump
migration plan
deprecation period
consumer update
compatibility view if useful
```

### Manage semantic changes

Changing the meaning/formula of a metric is a breaking change even if schema is unchanged.

### Validate source schema drift

Incoming files/APIs/events should be validated. Unexpected breaking drift should fail/quarantine, not silently corrupt data.

### Migrations must handle existing data

For database changes, define:

```text
data backfill
constraints
defaults
rollback or forward-fix
index/performance impact
deployment order
```

## Verification

Use:

- schema contract tests
- backward compatibility tests
- consumer-driven contract tests
- migration tests
- backfill tests
- old/new metric comparison
- dashboard regression tests
- event compatibility tests
- source schema drift tests

## Anti-patterns

Do not:

- rename/remove shared columns without migration path
- change metric meaning silently
- update dashboards but ignore ML/API consumers
- treat CSV column order as stable without validation
- deploy schema and app changes in unsafe order
