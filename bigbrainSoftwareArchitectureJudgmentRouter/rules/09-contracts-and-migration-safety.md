# 09 Contracts and Migration Safety

Use when changing APIs, schemas, configs, events, persisted data, file formats, CLIs, integrations, or public behavior.

Primary sources: _Refactoring_, _DDIA_, _Release It!_

## Core judgment

Shared contracts require compatibility and migration discipline. Breakage often happens outside the file you edited.

## Triggers

- public API change
- DB migration
- event/payload change
- config/CLI behavior change
- file format change
- third-party integration
- persisted behavior
- user-facing workflow change

## Rules

- Identify consumers.
- Prefer expand-and-contract migrations: add new compatible shape, backfill/sync, migrate consumers, remove old shape later.
- Version breaking changes.
- Migrations must handle existing data: backfill, constraints, defaults, null handling, large-table performance, rollback/forward-fix, deployment order.
- Contract tests protect boundaries.

## Verification

- contract tests
- migration tests
- backward compatibility tests
- consumer regression tests
- deployment-order review
- rollback/forward-fix plan
- data backfill validation

## Anti-patterns

Do not rename/remove shared fields in one step, change semantic meaning under the same name, deploy schema/app changes in unsafe order, assume only current repo consumes an API/event, or skip existing-data migration cases.
