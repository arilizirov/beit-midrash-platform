# 02 Refactoring and Safe Change

Use when improving structure while preserving behavior.

Primary source: _Refactoring_
Secondary sources: _Working Effectively with Legacy Code_, _Clean Code_

## Core judgment

Refactoring is behavior-preserving design improvement. It should happen in small, verified steps.

## Triggers

- long method/class
- duplicated code
- shotgun surgery
- feature envy
- primitive obsession
- large conditionals
- hard-to-test code
- user asks to clean up or make better

## Rules

- Separate behavior change from refactoring.
- Work in small steps.
- Establish safety first with existing or characterization tests.
- Refactor toward known pressure; do not refactor unrelated areas.
- Preserve public contracts unless there is an explicit migration/versioning plan.

## Verification

- run existing tests
- add characterization tests if needed
- compare before/after outputs
- test boundary cases
- build/typecheck
- review diff for unintended behavior changes

## Anti-patterns

Do not rewrite instead of refactor unless justified, mix cleanup and feature work invisibly, update tests mechanically, or introduce abstractions only because a pattern exists.
