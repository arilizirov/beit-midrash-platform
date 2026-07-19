---
name: bigbrainDataArchitectureJudgmentRouter
description: Judgment-router skill pack for Codex. Use when a task involves data architecture, databases, schemas, data pipelines, analytics models, warehouses, marts, metrics, dashboards, data products, Data Mesh, Data Vault, governance, metadata, lineage, data quality, sensitive data, distributed data systems, or data integration. Routes Codex to the right book-derived senior-engineering judgment from 8 cornerstone data architecture sources.
---

# bigbrainDataArchitectureJudgmentRouter

This is a judgment-router skill pack.

It is not a book-summary skill.

It exists to make Codex behave like a senior data architect by:

1. classifying the data task
2. detecting architectural risk
3. selecting the relevant source-derived judgment
4. applying only the necessary rules
5. avoiding overengineering
6. verifying the result with tests/checks

## Sources (original notes)

This skill routes across short original principle notes (paraphrase, not book text) for 8 works:

1. _Designing Data-Intensive Applications_
2. _Fundamentals of Data Engineering_
3. _The Data Warehouse Toolkit_
4. _Building the Data Warehouse_
5. _DAMA-DMBOK_
6. _Data Mesh_
7. _Modeling the Agile Data Warehouse with Data Vault_
8. _Data and Reality_

Do not read all sources by default.  
Use the router first.

---

# Core rule

Before writing or changing code, schema, SQL, pipelines, or architecture:

```text
Classify → Route → Apply → Verify → Report
```

## 1. Classify

Classify the task as one or more:

```text
conceptual/domain data modeling
operational database/schema design
analytics/reporting dimensional model
data warehouse / enterprise integration
data pipeline / ETL / ELT
source ingestion / CDC / streaming
distributed data systems
data product / Data Mesh
Data Vault / historized integration
data governance / metadata / lineage
master/reference data
data quality / reconciliation
metric / dashboard definition
security/privacy-sensitive data
ML feature / point-in-time data
reverse ETL / operational analytics
performance/cost optimization
migration/backfill/schema evolution
```

## 2. Route

Use the routing table in:

```text
router/00-judgment-router.md
```

Then consult only the relevant rule file/source.

## 3. Apply

Apply the smallest useful subset of rules.

Do not apply every principle.

**KISS:** prefer the simplest model/pipeline/schema that meets the request as it stands. No extra layer, historization, vault, mart, or tool without a present-day force that requires it. The burden of proof is on added complexity.

Prefer the simplest design that preserves:

```text
meaning
identity
correctness
history
data quality
lineage
security
consumer contracts
operability
future change
```

## 4. Verify

Choose the relevant verification:

```text
schema constraints
migration tests
source-to-target reconciliation
grain tests
metric tests
contract tests
data quality checks
freshness checks
idempotency/rerun tests
backfill tests
performance/cost checks
access-control tests
lineage/metadata checks
consumer acceptance tests
```

## 5. Report

Final answer should be concise:

```text
Task type:
Judgment route used:
Key decision:
Assumptions:
Changes:
Verification:
Risks / follow-up:
```

---

# Always-on senior data architecture checks

Use these checks for any non-trivial data task.

## Meaning

```text
What real-world thing, relationship, event, state, or measurement is being represented?
```

## Identity

```text
Is this a technical ID, source ID, business key, surrogate key, or real-world identity?
```

## Workload

```text
Is this operational, analytical, integration, data product, ML, or reverse-ETL data?
```

## Grain

```text
What does one row/event/message represent?
```

## Source of truth

```text
Is this authoritative or derived?
```

## Time

```text
Does this value represent event time, effective time, load time, or current state?
```

## Quality

```text
What can go wrong, and what checks catch it before consumers are misled?
```

## Contract

```text
Who consumes this, and can this change break them?
```

## Lineage

```text
Can a value be traced back to source and transformation?
```

## Security

```text
Is sensitive data collected, copied, logged, exposed, exported, or retained?
```

## Operation

```text
Can the pipeline/job/migration rerun, recover, and be monitored?
```

---

# High-risk triggers

If any trigger appears, stop and route.

## Public/shared data contract

If changing a shared schema, API, event, file format, semantic model, data product, warehouse table, or dashboard source:

```text
Route to contract/schema evolution rules.
Check consumers, compatibility, versioning, migration, deprecation, and tests.
```

## Analytics table or metric

If designing a reporting table, BI model, or metric:

```text
Route to dimensional modeling.
Declare grain first.
Check additivity, facts/dimensions, conformed dimensions, metric definitions, and double-counting.
```

## Pipeline or ingestion

If building or changing ETL/ELT, ingestion, sync, CDC, streaming, or orchestration:

```text
Route to data engineering lifecycle.
Check source semantics, updates/deletes, raw/staging/curated layers, idempotency, backfill, quality, lineage, and monitoring.
```

## Core entity / identity

If modeling customers, students, families, accounts, users, products, people, organizations, or other shared entities:

```text
Route to conceptual modeling + master data.
Check identity, roles, duplicates, source IDs, merges/splits, relationships, lifecycle, and stewardship.
```

## Multi-source enterprise integration

If integrating multiple sources for historical/auditable enterprise data:

```text
Route to enterprise warehouse and possibly Data Vault.
Check subject areas, business keys, source lineage, historization, integration foundation, marts, and audit metadata.
```

## Domain-owned consumer dataset

If publishing data for other teams or domains:

```text
Route to Data Mesh/data product readiness.
Check owner, contract, docs, quality, freshness, access, lineage, support, versioning, and consumer needs.
```

## Sensitive data

If touching PII, student/child/family data, financial data, health notes, auth/security data, exports, logs, or raw data zones:

```text
Route to governance/security.
Check classification, least privilege, masking, safe logging, audit, retention, deletion, and downstream propagation.
```

## Distributed data system

If changing replication, transactions, event logs, consistency, partitions, caches, derived data, queues, or distributed workflows:

```text
Route to DDIA/distributed systems.
Check consistency, failure modes, ordering, idempotency, retries, backpressure, recovery, and derived-data correctness.
```

---

# Anti-patterns

Do not:

```text
copy OLTP schemas directly into analytics as the final reporting model
```

```text
create schemas from form fields without conceptual modeling
```

```text
use source IDs as enterprise identity without analysis
```

```text
mix multiple grains in one fact/reporting table
```

```text
sum percentages, ratios, balances, or snapshots without additivity rules
```

```text
hide business logic inside dashboards or one-off SQL
```

```text
build streaming systems for slow batch needs
```

```text
publish raw internal tables as data products
```

```text
treat raw event streams as finished data products
```

```text
ignore schema contracts and downstream consumers
```

```text
build recurring pipelines without idempotency, batch metadata, observability, or backfill strategy
```

```text
store uncertain, guessed, AI-extracted, or source-conflicting values as certain facts without confidence/provenance
```

```text
overuse Data Mesh, Data Vault, Kafka, Spark, lakehouse, or warehouse patterns when simpler architecture is enough
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

When responding after using this skill:

```text
Task type:
Route used:
Decision:
Changes:
Verification:
Risks / follow-up:
```

Keep it short unless the user asks for a full architecture review.
