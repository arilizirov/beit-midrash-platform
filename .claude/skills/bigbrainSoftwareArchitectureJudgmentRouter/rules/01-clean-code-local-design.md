# 01 Clean Code and Local Design

Use for local code clarity, naming, functions, classes, duplication, comments, and maintainability.

Primary source: _Clean Code_
Secondary sources: _Refactoring_, _GOOS_

## Core judgment

Readable code exposes intent. The goal is not smaller code or clever code; the goal is code whose behavior and reason for existing are easy to understand and safely change.

## Triggers

- unclear names
- long functions/classes
- duplicated logic
- tangled conditionals
- comments explaining confusing code
- mixed abstraction levels
- hidden side effects
- primitive obsession
- data clumps
- unclear responsibilities

## Rules

- Name things by intent, domain meaning, and role.
- Keep functions/classes/modules cohesive.
- Remove duplication carefully; do not abstract before the variation pattern is understood.
- Prefer explicitness over cleverness.
- Comments should explain why; confusing code should usually be clarified.
- Separate business policy from low-level mechanics when tangling causes change risk.

## Verification

- existing tests pass
- add unit tests for extracted behavior
- review names against domain language
- compare before/after behavior
- run formatter/linter/build

## Anti-patterns

Do not create tiny functions that obscure flow, rename everything mechanically, replace clear duplication with unclear indirection, or change behavior during cleanup without saying so.
