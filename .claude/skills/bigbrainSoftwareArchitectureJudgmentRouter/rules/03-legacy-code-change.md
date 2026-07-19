# 03 Legacy Code Change

Use when changing code with poor tests, unclear behavior, hidden coupling, or high regression risk.

Primary source: _Working Effectively with Legacy Code_
Secondary sources: _Refactoring_, _GOOS_

## Core judgment

Legacy code change requires safety before improvement. Characterize current behavior, create seams, then make small verified changes.

## Triggers

- no tests
- unclear current behavior
- high coupling/global state
- hard-to-instantiate classes
- static/singleton dependencies
- hidden side effects
- risky bug fix
- broad old module

## Rules

- Characterize current behavior before changing risky code.
- Find seams to substitute dependencies or isolate logic.
- Break dependencies carefully and only where it enables safe change.
- Change one thing at a time.
- Preserve behavior unless explicit bug fix; for bug fixes, test current broken scenario and intended fixed behavior.

## Verification

- characterization tests
- regression tests for bug scenario
- smoke tests around affected workflow
- dependency seam tests
- compare old/new behavior where possible

## Anti-patterns

Do not delete ugly code before understanding it, rewrite large legacy modules casually, mock everything instead of finding useful seams, or combine broad refactor with risky behavior change.
