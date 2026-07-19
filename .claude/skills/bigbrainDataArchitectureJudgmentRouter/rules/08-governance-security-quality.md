# 08 Governance, Security, Metadata, Lineage, and Quality

Use when data is important, shared, sensitive, decision-driving, integrated, or production-facing.

Primary source: _DAMA-DMBOK_  
Secondary sources: _Fundamentals of Data Engineering_, _Data Mesh_, _Data and Reality_

## Core judgment

Important data must be managed as an asset: meaning, owner, source of truth, quality, security, lineage, lifecycle, and change impact.

## Governance rules

Define:

```text
data owner
data steward
source of truth
definition owner
quality owner
access policy owner
change approval/review path
```

Scale governance by risk.

## Metadata and lineage rules

Capture:

```text
owner/domain
business definition
source system
source record ID where useful
load batch/run ID
loaded_at/extracted_at
transformation logic
freshness
quality checks/status
sensitivity classification
lineage
known limitations
examples
```

## Quality rules

Add checks for:

```text
freshness
completeness
validity
uniqueness
referential integrity
accuracy
consistency
conformity
reasonableness
reconciliation
schema drift
```

## Security/privacy rules

For sensitive data:

```text
classify fields
apply least privilege
mask/tokenize when possible
avoid logging sensitive values
restrict raw-zone access
audit sensitive access/export
define retention/deletion
use anonymized test data
propagate restrictions downstream
```

## Master/reference data rules

Master data:

```text
core shared entity
identity rules
source of truth
matching/merge/split
stewardship
audit corrections
```

Reference data:

```text
controlled values
definitions
owner
validation
history/effective dates if needed
external mappings
```

## Verification

Use:

- metadata completeness tests
- lineage checks
- source-to-target reconciliation
- data quality tests
- access-control tests
- masking/safe logging tests
- retention/deletion tests
- audit log tests
- master data duplicate/merge tests
- reference accepted-value tests

## Anti-patterns

Do not:

- create shared datasets with no owner
- expose sensitive data broadly because it is “analytics”
- use magic strings for governed statuses/categories
- hide lineage for integrated data
- keep everything forever by default
- copy production PII into dev/test
