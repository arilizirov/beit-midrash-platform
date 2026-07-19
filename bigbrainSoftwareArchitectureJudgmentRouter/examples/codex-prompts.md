# Example Codex Prompts

## Review a proposed architecture
Use the bigbrainSoftwareArchitectureJudgmentRouter skill. Classify the task, route to the relevant rules, and review this architecture for tradeoffs, coupling, data ownership, deployability, production failure modes, and overengineering risk.

## Refactor safely
Use the bigbrainSoftwareArchitectureJudgmentRouter skill. Refactor this code while preserving behavior. Add characterization tests first if existing test coverage is weak. Keep the change small and explain verification.

## Legacy bug fix
Use the bigbrainSoftwareArchitectureJudgmentRouter skill. Fix this bug in legacy code. First identify current behavior, add a characterization or regression test, then make the smallest safe change.

## Production-readiness review
Use the bigbrainSoftwareArchitectureJudgmentRouter skill. Review this production path for timeouts, retries, resource limits, cascading failure, observability, idempotency, and recovery behavior.

## Distributed workflow review
Use the bigbrainSoftwareArchitectureJudgmentRouter skill. Review this event-driven workflow for consistency, ordering, duplicate messages, idempotency, replay, derived-data correctness, and failure recovery.

## Test design
Use the bigbrainSoftwareArchitectureJudgmentRouter skill. Add tests that verify behavior through stable interfaces. Avoid brittle tests that assert implementation details unless those details are part of the contract.

## Migration review
Use the bigbrainSoftwareArchitectureJudgmentRouter skill. Review this API/schema migration for compatibility, consumers, deployment order, backfill, rollback/forward-fix, and contract tests.
