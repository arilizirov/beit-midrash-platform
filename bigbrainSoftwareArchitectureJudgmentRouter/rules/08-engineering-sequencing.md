# 08 Engineering Sequencing and Senior Judgment

Use for what-to-do-next decisions, roadmap, refactor vs feature, rewrite decisions, prioritization, and engineering management judgment.

Primary source: _An Elegant Puzzle_
Secondary sources: _Software Architecture: The Hard Parts_, _Release It!_

## Core judgment

Good senior engineering is sequencing work by risk, leverage, learning, and team capacity. Do the smallest high-leverage step that improves future options.

## Triggers

- many possible improvements
- rewrite temptation
- roadmap/prioritization
- tech debt vs feature
- architecture migration
- production risk reduction
- team capacity/process issue

## Rules

- Prioritize by leverage and risk.
- Prefer reversible steps when uncertain.
- Avoid hero rewrites; prefer strangler patterns, module-by-module replacement, or seams unless rewrite is justified.
- Install load-bearing minimum process/tooling/checks without bureaucracy.
- Match process to team maturity.

## Verification

- define success criteria
- define next smallest milestone
- identify rollback/exit strategy
- review risk reduction
- capture decision/tradeoff
- measure feedback

## Anti-patterns

Do not start a massive rewrite because code feels ugly, collect tools/processes instead of solving bottlenecks, prioritize low-leverage polish over production/customer risk, or make architecture plans with no first useful slice.
