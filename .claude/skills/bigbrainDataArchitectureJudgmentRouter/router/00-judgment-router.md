# 00-judgment-router.md

This file routes Codex from a data task to the relevant source-derived judgment.

Do not read all source files.  
Use this router to select only what matters.

---

# Route map

## A. Conceptual/domain modeling

Use when:

- creating or changing core entities
- modeling people, students, families, customers, accounts, products, classes, payments
- terms are ambiguous
- IDs, roles, relationships, categories, time, nulls, or provenance are unclear

Primary source:

```text
Data and Reality
```

Secondary sources:

```text
DAMA-DMBOK
Data Warehouse Toolkit
Modeling the Agile Data Warehouse with Data Vault
```

Use rules:

```text
rules/01-conceptual-modeling-and-identity.md
rules/08-governance-security-quality.md
```

Main judgment:

```text
Data models are purposeful simplifications of messy reality. Clarify meaning, identity, relationships, time, categories, missingness, uncertainty, and provenance before encoding schema.
```

---

## B. Operational database/schema design

Use when:

- designing OLTP schemas
- adding migrations
- changing constraints/relationships
- creating application persistence models
- schema affects production workflows

Primary sources:

```text
Data and Reality
DAMA-DMBOK
Designing Data-Intensive Applications
```

Use rules:

```text
rules/01-conceptual-modeling-and-identity.md
rules/02-operational-vs-analytical.md
rules/10-contracts-schema-evolution.md
```

Main judgment:

```text
Operational schemas should protect transactional correctness and domain invariants. Clarify identity, relationships, lifecycle, constraints, migration safety, and source-of-truth boundaries.
```

---

## C. Analytics/reporting/dimensional modeling

Use when:

- building BI tables
- creating facts/dimensions
- designing dashboards
- defining metrics
- debugging double-counting
- reporting query is too complex
- operational schema is being copied into analytics

Primary source:

```text
The Data Warehouse Toolkit
```

Secondary sources:

```text
Building the Data Warehouse
Fundamentals of Data Engineering
DAMA-DMBOK
Data and Reality
```

Use rules:

```text
rules/03-dimensional-analytics.md
rules/08-governance-security-quality.md
rules/10-contracts-schema-evolution.md
```

Main judgment:

```text
Declare grain first. Model measurable business processes as facts and descriptive context as dimensions. Define additivity, conformed dimensions, history strategy, governed metrics, and quality checks.
```

---

## D. Data pipeline / ETL / ELT

Use when:

- ingesting from APIs, DBs, files, SaaS, streams
- writing transformations
- orchestrating jobs
- building warehouse/lake/lakehouse flows
- adding data quality checks
- handling retries/backfills

Primary source:

```text
Fundamentals of Data Engineering
```

Secondary sources:

```text
Designing Data-Intensive Applications
DAMA-DMBOK
Building the Data Warehouse
```

Use rules:

```text
rules/04-data-engineering-lifecycle.md
rules/08-governance-security-quality.md
rules/10-contracts-schema-evolution.md
```

Main judgment:

```text
Design lifecycle-first: source semantics, ingestion mode, raw/staging/curated/serving layers, transformations, orchestration, quality, lineage, idempotency, backfill, monitoring, and retention.
```

---

## E. Distributed data systems

Use when:

- transactions, consistency, isolation, replication, partitioning
- caches, queues, event logs, streams
- derived data, materialized views, read models
- distributed workflows, retries, idempotency, ordering
- data correctness under failure

Primary source:

```text
Designing Data-Intensive Applications
```

Secondary sources:

```text
Fundamentals of Data Engineering
Release It-style production readiness if available in broader BigBrainSE
```

Use rules:

```text
rules/05-distributed-data-systems.md
rules/04-data-engineering-lifecycle.md
```

Main judgment:

```text
Make consistency, ordering, failure, replay, idempotency, partitioning, and derived-data correctness explicit. Avoid pretending distributed systems behave like one local database.
```

---

## F. Enterprise data warehouse / integrated foundation

Use when:

- creating EDW/integration layer
- integrating multiple source systems
- preserving historical enterprise data
- separating operational and analytical systems
- building marts from an integrated foundation
- subject-oriented modeling

Primary source:

```text
Building the Data Warehouse
```

Secondary sources:

```text
The Data Warehouse Toolkit
DAMA-DMBOK
Modeling the Agile Data Warehouse with Data Vault
```

Use rules:

```text
rules/02-operational-vs-analytical.md
rules/06-enterprise-warehouse-data-vault.md
rules/03-dimensional-analytics.md
```

Main judgment:

```text
Enterprise analytics needs integrated, subject-oriented, historical, governed data separate from operational systems. Marts should be delivered incrementally from a trustworthy foundation when consistency matters.
```

---

## G. Data Vault / historized integration

Use when:

- multi-source integration
- auditability and source lineage
- historized enterprise warehouse foundation
- raw vs business interpretation separation
- Hubs/Links/Satellites are proposed
- agile source evolution matters

Primary source:

```text
Modeling the Agile Data Warehouse with Data Vault
```

Secondary sources:

```text
Building the Data Warehouse
Data Warehouse Toolkit
DAMA-DMBOK
```

Use rules:

```text
rules/06-enterprise-warehouse-data-vault.md
```

Main judgment:

```text
Use Data Vault for auditable, historized, source-traceable integration through Hubs, Links, Satellites, load metadata, raw/business separation, and downstream presentation marts.
```

---

## H. Data governance / metadata / lineage / quality

Use when:

- data ownership is unclear
- reports are not trusted
- data quality is poor
- metadata/catalog/lineage is missing
- master/reference data is involved
- retention/security/stewardship matters

Primary source:

```text
DAMA-DMBOK
```

Secondary sources:

```text
Fundamentals of Data Engineering
Data Mesh
Data and Reality
```

Use rules:

```text
rules/08-governance-security-quality.md
```

Main judgment:

```text
Important data needs meaning, ownership, stewardship, quality controls, metadata, lineage, lifecycle, security, and change governance.
```

---

## I. Data Mesh / data products

Use when:

- publishing datasets for other teams
- domain ownership is being assigned
- central data team is a bottleneck
- data product readiness is being checked
- self-serve platform/governance is discussed
- Data Mesh is proposed

Primary source:

```text
Data Mesh
```

Secondary sources:

```text
DAMA-DMBOK
Fundamentals of Data Engineering
The Data Warehouse Toolkit
```

Use rules:

```text
rules/07-data-products-data-mesh.md
rules/08-governance-security-quality.md
rules/10-contracts-schema-evolution.md
```

Main judgment:

```text
A data product is not just a table. It needs domain owner, contract, docs, quality, freshness, access policy, lineage, examples, support, and lifecycle. Use full Data Mesh only when scale justifies it.
```

---

## J. Sensitive data / privacy / security

Use when:

- PII, student/child/family data, financial data, health notes
- raw data zones
- logs, exports, dashboards, AI/ML features
- access controls or retention
- external sharing or data products

Primary source:

```text
DAMA-DMBOK
```

Secondary sources:

```text
Fundamentals of Data Engineering
Data Mesh
Data and Reality
```

Use rules:

```text
rules/08-governance-security-quality.md
```

Main judgment:

```text
Sensitive data controls apply across the full lifecycle: collection, ingestion, storage, transformation, serving, logs, exports, retention, deletion, and downstream copies.
```

---

## K. ML feature / advanced analytics data

Use when:

- training datasets
- prediction features
- labels and feature joins
- feature stores
- automated decisions
- point-in-time correctness

Primary source:

```text
Fundamentals of Data Engineering
```

Secondary sources:

```text
Designing Data-Intensive Applications
Data and Reality
DAMA-DMBOK
```

Use rules:

```text
rules/09-ml-reverse-etl-performance.md
```

Main judgment:

```text
ML data requires point-in-time correctness, leakage prevention, reproducibility, lineage, and training-serving consistency.
```

---

## L. Reverse ETL / operational analytics

Use when:

- warehouse/analytics data flows back into operational apps
- CRM/admin tools receive derived metrics/scores
- dashboards trigger operations
- analytical recommendations affect workflows

Primary source:

```text
Fundamentals of Data Engineering
```

Secondary sources:

```text
DAMA-DMBOK
Designing Data-Intensive Applications
```

Use rules:

```text
rules/09-ml-reverse-etl-performance.md
```

Main judgment:

```text
Do not let derived/stale analytics silently become operational truth. Label derived data, show freshness, audit writes, and preserve source-of-truth boundaries.
```

---

## M. Cost/performance optimization

Use when:

- warehouse costs are high
- dashboards are slow
- full refreshes are expensive
- tables are large
- streaming/compute/storage costs matter
- partitioning/clustering/indexing is needed

Primary source:

```text
Fundamentals of Data Engineering
```

Secondary sources:

```text
Designing Data-Intensive Applications
The Data Warehouse Toolkit
```

Use rules:

```text
rules/09-ml-reverse-etl-performance.md
rules/04-data-engineering-lifecycle.md
```

Main judgment:

```text
Treat cost and performance as architectural constraints: partition, cluster/index, process incrementally, aggregate intentionally, monitor cost/runtime, and avoid premature complexity.
```

---

# Routing output template

When using the router internally, Codex should produce for itself:

```text
Task type:
Blast radius:
Primary route:
Secondary route:
Triggered rules:
Verification needed:
Overengineering risks:
```

Do not expose the full internal routing unless the user asks.
