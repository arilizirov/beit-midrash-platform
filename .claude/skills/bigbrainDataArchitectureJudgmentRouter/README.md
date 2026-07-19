# bigbrainDataArchitectureJudgmentRouter

A Codex skill pack that turns 8 cornerstone data architecture books into a practical judgment router.

## Purpose

This is not a book summary bundle.

It is a routing system for Codex:

```text
classify the data task
detect architectural risk
route to the relevant book-derived rules
apply only the needed judgment
verify with tests/checks
avoid overengineering
```

## Contents

```text
bigbrainDataArchitectureJudgmentRouter/
  SKILL.md
  router/
    00-judgment-router.md
  rules/
    01-conceptual-modeling-and-identity.md
    02-operational-vs-analytical.md
    03-dimensional-analytics.md
    04-data-engineering-lifecycle.md
    05-distributed-data-systems.md
    06-enterprise-warehouse-data-vault.md
    07-data-products-data-mesh.md
    08-governance-security-quality.md
    09-ml-reverse-etl-performance.md
    10-contracts-schema-evolution.md
  checklists/
    data-architecture-review-checklist.md
  sources/
    00-source-index.md
    [8 source extraction files]
  examples/
    codex-prompts.md
```

## How Codex should use this

1. Read `SKILL.md`.
2. Use `router/00-judgment-router.md` to classify and route.
3. Use the relevant `rules/*.md`.
4. Consult source extraction files only when deeper judgment is needed.
5. Run or recommend relevant verification.

## Design principle

The goal is not to make Codex verbose or academic.

The goal is to make Codex ask the right senior data architecture questions at the right time.
