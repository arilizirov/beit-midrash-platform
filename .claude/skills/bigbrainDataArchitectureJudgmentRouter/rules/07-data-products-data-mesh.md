# 07 Data Products and Data Mesh

Use when publishing datasets for consumers, assigning domain ownership, checking data product readiness, designing Data Mesh-like architecture, or managing producer-consumer data contracts.

Primary source: _Data Mesh_  
Secondary sources: _DAMA-DMBOK_, _Fundamentals of Data Engineering_

## Core judgment

A data product is not a table. It is a consumer-facing, owned, documented, trustworthy, secure, and supported data interface.

## Data product readiness

A published data product needs:

```text
domain owner
business description
consumer/use case
contract/schema
grain/entity meaning
field definitions
freshness expectation
quality checks/status
access policy
sensitivity classification
lineage/source
sample query/example
versioning/deprecation policy
support/issue path
consumer feedback
```

## Data Mesh triggers

Use Data Mesh thinking when:

- central data team is a bottleneck
- multiple domains produce and consume data
- domains understand their data better than central teams
- data product ownership is needed
- self-serve platform and governance automation are possible

## Data Mesh rules

- Domain teams own meaning and quality.
- Platform team owns reusable infrastructure/golden paths.
- Governance should be federated and automated where possible.
- Products must interoperate through shared identity/time/reference/semantic standards.
- Start with pilots.
- Do not cargo-cult full mesh in small/simple systems.

## Verification

Use:

- product readiness checklist
- metadata completeness checks
- schema contract tests
- data quality/freshness tests
- access-control tests
- catalog publication tests
- consumer query tests
- version/deprecation tests
- interoperability tests

## Anti-patterns

Do not:

- call a raw table a data product
- publish without owner/docs/quality/freshness/access
- decentralize into chaos without platform/governance
- buy a catalog and call it Data Mesh
- force Data Mesh when a simple mart/warehouse is enough
