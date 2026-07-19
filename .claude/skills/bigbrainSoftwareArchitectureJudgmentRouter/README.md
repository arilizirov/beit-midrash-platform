# bigbrainSoftwareArchitectureJudgmentRouter

A Codex skill pack that turns software architecture and senior engineering sources into a practical judgment router.

## Purpose

This is not a book summary bundle.

It is a routing system for Codex:

```text
classify the task
detect engineering risk
route to relevant source-derived rules
make the smallest safe change
verify with tests/checks
avoid overengineering
```

## Contents

```text
bigbrainSoftwareArchitectureJudgmentRouter/
  SKILL.md
  router/00-judgment-router.md
  rules/[10 focused rule files]
  checklists/software-architecture-review-checklist.md
  sources/00-source-index.md
  sources/[source extraction files or placeholders]
  examples/codex-prompts.md
  manifest.json
```

## How Codex should use this

1. Read `SKILL.md`.
2. Use `router/00-judgment-router.md` to classify and route.
3. Use the relevant `rules/*.md`.
4. Consult source extraction files only when deeper judgment is needed.
5. Run or recommend relevant verification.

## Design principle

This skill should make Codex disciplined, not verbose.

The goal is to ask the right senior engineering questions at the right time.
