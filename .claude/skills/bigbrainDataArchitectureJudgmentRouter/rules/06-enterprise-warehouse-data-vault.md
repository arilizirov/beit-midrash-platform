# 06 Enterprise Warehouse and Data Vault

Use for enterprise data warehouse foundations, multi-source integration, historized audit layers, Data Vault, Raw Vault, Business Vault, and marts derived from integrated history.

Primary sources: _Building the Data Warehouse_, _Modeling the Agile Data Warehouse with Data Vault_  
Secondary sources: _The Data Warehouse Toolkit_, _DAMA-DMBOK_

## Core judgment

Enterprise analytics needs integrated, historical, subject-oriented, auditable data separate from operational systems. Use Data Vault only when integration/history/audit justify it.

## Enterprise warehouse rules

- Separate operational systems from analytical systems.
- Organize integrated warehouse data around durable business subjects.
- Preserve time-variant history.
- Treat warehouse changes as controlled and auditable.
- Use marts/presentation layers for departmental/BI consumption.
- Deliver incrementally around business value.

## Data Vault triggers

Use Data Vault when:

```text
many sources
changing source structures
auditable source lineage
historical preservation
enterprise integration
agile schema extension
raw vs business interpretation separation
```

Avoid it when:

```text
single source
simple reporting
small team
low audit/history need
quick dimensional mart is enough
```

## Data Vault rules

### Hubs

Stable business keys only. No descriptive attributes.

### Links

Business relationships or transactions between Hubs.

### Satellites

Descriptive attributes and historized context.

### Metadata

Every vault record should include:

```text
load_dts
record_source
load_batch_id/run_id where useful
hashdiff where useful
source identifier where useful
```

### Raw vs Business Vault

Raw Vault preserves source-aligned history.  
Business Vault applies derived business interpretation.

### Presentation

Do not expose raw vault complexity to business users. Derive marts, views, semantic layers, or data products.

## Verification

Use:

- Hub key uniqueness tests
- Link relationship uniqueness tests
- Satellite historization/hashdiff tests
- source-to-vault reconciliation
- load timestamp/source tests
- idempotent rerun tests
- vault-to-mart reconciliation
- PIT/Bridge correctness tests
- metadata completeness checks

## Anti-patterns

Do not:

- put changing descriptive attributes in Hubs
- create Links with no business meaning
- expose raw Hubs/Links/Satellites directly to BI users
- apply business transformations destructively in Raw Vault
- automate Data Vault objects without semantic review
