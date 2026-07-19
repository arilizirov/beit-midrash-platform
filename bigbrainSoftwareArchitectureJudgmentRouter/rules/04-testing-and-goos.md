# 04 Testing and Test-Guided Design

Use for test design, TDD-style work, brittle tests, object boundaries, mocks, and behavior verification.

Primary source: _Growing Object-Oriented Software, Guided by Tests_
Secondary sources: _Working Effectively with Legacy Code_, _Refactoring_

## Core judgment

Tests should verify behavior through stable interfaces and guide better design. They should not merely lock implementation details.

## TDD loop (default for new behavior)

For any new or changed behavior, work the cycle one behavior at a time:

```text
RED    write the smallest failing test that states the next behavior; run it; confirm it fails for the right reason
GREEN  write the minimum code to pass; nothing speculative
REFACTOR  clean up with the test green; no new behavior in this step
```

- One behavior per cycle. Do not batch many tests then many features.
- Start from observable behavior/API; let internals emerge from what the test needs.
- The failing run is not optional — a test that has never been seen red proves nothing.
- Exceptions (state them, don't skip silently): trivial non-behavioral edits, and exploratory spikes that are thrown away before the real test-first implementation.

## Triggers

- adding feature tests
- designing new objects/modules
- brittle tests
- over-mocking
- hard-to-test code
- unclear object responsibilities
- legacy behavior needs characterization

## Rules

- Test behavior, not implementation trivia.
- For user-visible features, start from observable behavior/API and drive internals as needed.
- Mock roles/collaborations, not every object blindly.
- Let hard-to-test code reveal hidden coupling or unclear responsibilities.
- Use purposeful levels: unit, integration, contract, characterization, end-to-end.

## Verification

- tests fail before fix when practical
- tests pass after fix
- test names describe behavior
- mocks assert meaningful interactions only
- critical path has an appropriate higher-level test

## Anti-patterns

Do not test private methods by habit, over-mock value objects, assert internal call order unless order is behavior, or update tests mechanically after refactor.
