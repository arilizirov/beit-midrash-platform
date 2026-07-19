# Example Codex prompts

## Review a schema

Use the bigbrainDataArchitectureJudgmentRouter skill. Classify this data task, route to the relevant judgment rules, and review this schema for identity, relationships, operational vs analytical concerns, history, data quality, and future reporting risk. Do not rewrite everything; propose the smallest safe improvement plan.

## Build a dimensional model

Use the bigbrainDataArchitectureJudgmentRouter skill. Route to dimensional analytics. Declare grain first, then propose facts, dimensions, conformed dimensions, metrics, additivity rules, history strategy, and quality/reconciliation tests.

## Review a pipeline

Use the bigbrainDataArchitectureJudgmentRouter skill. Route to data engineering lifecycle. Review this pipeline for source semantics, ingestion mode, raw/staging/curated/serving layers, idempotency, backfill, schema drift, data quality, lineage, observability, and sensitive data handling.

## Data product readiness

Use the bigbrainDataArchitectureJudgmentRouter skill. Route to data products/Data Mesh. Check whether this dataset is production-ready as a data product: owner, contract, docs, grain, quality, freshness, access policy, lineage, examples, support, versioning, and lifecycle.

## Data Vault decision

Use the bigbrainDataArchitectureJudgmentRouter skill. Decide whether Data Vault is justified here. Check source count, history/audit needs, source lineage, business keys, integration volatility, downstream marts, and whether a simpler dimensional/warehouse model is enough.

## Distributed data review

Use the bigbrainDataArchitectureJudgmentRouter skill. Route to distributed data systems. Review this event/queue/CDC/read-model design for consistency, ordering, duplicates, idempotency, replay, derived-data correctness, failure recovery, and monitoring.

## Sensitive data review

Use the bigbrainDataArchitectureJudgmentRouter skill. Route to governance/security. Review this data flow for PII/sensitive data classification, least privilege, masking, safe logging, audit, export controls, retention, and downstream propagation.
