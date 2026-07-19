# 01 Conceptual Modeling and Identity

Use for core schemas, domain models, API resources, imports, identity resolution, master entities, and ambiguous business terms.

Primary source: _Data and Reality_  
Secondary sources: _DAMA-DMBOK_, _Data Warehouse Toolkit_, _Data Vault_

## Core judgment

Data models are not reality. They are purposeful simplifications. Before encoding important data, clarify:

```text
real-world concept
identity
roles
relationships
categories
time
missingness
uncertainty
provenance
assumptions
exceptions
```

## Triggers

Apply when:

- creating or changing core entities
- modeling people, students, families, customers, accounts, products, classes, payments
- source IDs are being treated as identity
- categories/statuses are unclear
- null/missing values are ambiguous
- relationships have roles, history, attributes, or many-to-many behavior
- AI/imported/uncertain data is stored
- schema is being created from form fields

## Rules

### Model meaning before tables

Do not create tables directly from forms or payloads. First define what each entity/event/relationship represents.

### Identity is not an ID

Separate:

```text
technical key
source ID
business key
surrogate key
real-world identity
```

Preserve source IDs. Define duplicate, merge, split, and identity-change behavior when needed.

### Roles are not identities

A person/entity can play multiple roles. Separate identity from contextual roles when overlap or duplication exists.

### Relationships can be first-class

Use relationship tables when a relationship has:

```text
many-to-many cardinality
roles
attributes
history
effective dates
business meaning
```

### Attributes belong somewhere

Classify each attribute as:

```text
entity attribute
relationship attribute
event attribute
derived value
classification/status
technical metadata
```

Put it on the concept it describes.

### Categories need definitions

Statuses, types, segments, risk levels, and classifications are human definitions. Govern them when they affect workflow, reporting, billing, compliance, or decisions.

### Time has meaning

Distinguish:

```text
event time
effective time
load time
processing time
current state
```

### Null is not one meaning

Distinguish unknown, not applicable, not collected, refused, invalid, pending, and missing due to pipeline/source failure when it matters.

### Provenance matters

For imported, integrated, transformed, AI-extracted, or disputed data, store enough source/provenance/confidence to debug and trust it.

## Verification

Use:

- realistic example/counterexample tests
- uniqueness tests
- relationship cardinality tests
- lifecycle/status transition tests
- null/missingness tests
- source ID mapping tests
- merge/split tests
- provenance/audit tests
- migration tests with messy existing data

## Anti-patterns

Do not:

- assume source database ID is real-world identity
- create `status` without defining the lifecycle it belongs to
- store guessed/AI-extracted values as facts without confidence/provenance
- use generic Entity/Property/Value schemas unless true variability justifies it
- place relationship/event fields on core entities for convenience
