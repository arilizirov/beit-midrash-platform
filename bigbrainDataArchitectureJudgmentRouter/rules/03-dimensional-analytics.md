# 03 Dimensional Analytics

Use for BI, reporting models, dashboards, facts, dimensions, data marts, metrics, and double-counting issues.

Primary source: _The Data Warehouse Toolkit_  
Secondary sources: _Building the Data Warehouse_, _DAMA-DMBOK_, _Data and Reality_

## Core judgment

Declare the grain first. Model measurable business processes as facts and descriptive context as dimensions.

## Triggers

Apply when:

- designing reporting/BI tables
- creating facts/dimensions
- defining metrics
- copying OLTP tables into reporting
- dashboards have repeated complex joins
- counts/totals disagree
- double-counting appears
- users ask for slicing/filtering by business context

## Rules

### Declare grain first

Always write:

```text
Grain: one row per [business event/entity] at [level of detail].
```

### Separate facts and dimensions

Facts:

```text
numeric measurements
counts
event amounts
additive/semi-additive/non-additive measures
```

Dimensions:

```text
who/what/where/when/how descriptive context
```

### Model around business processes

Not source systems or departments.

Examples:

```text
registration submitted
payment received
invoice line posted
student attended class
class daily enrollment snapshot
```

### Preserve atomic detail when useful

Use atomic facts as source of truth. Derive aggregates for performance.

### Use the right fact type

```text
transaction fact = discrete event
periodic snapshot = regular state over time
accumulating snapshot = lifecycle workflow with milestones
factless fact = event/coverage/eligibility with no numeric amount
```

### Define additivity

Do not blindly sum:

```text
percentages
ratios
averages
balances
inventory
snapshot counts across time
```

Store additive components when possible.

### Use conformed dimensions

Shared dimensions like date, student/customer, product, family/account, class, school year, location should be consistent across facts when cross-process analytics matters.

### Handle slowly changing dimensions

Choose overwrite vs history per attribute. Preserve history where reporting needs event-time truth.

## Verification

Use:

- grain uniqueness tests
- duplicate tests
- fact-to-dimension referential integrity tests
- metric reconciliation tests
- aggregate-to-detail reconciliation
- additivity tests
- SCD/versioning tests
- double-counting tests
- dashboard acceptance tests

## Anti-patterns

Do not:

- mix multiple grains in one table
- store only summaries when drilldown/reconciliation needs detail
- sum ratios/percentages directly
- use local duplicate dimensions when conformed dimensions are needed
- expose normalized OLTP schemas as BI presentation
