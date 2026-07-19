# Software Architecture Review Checklist

Use before finishing non-trivial software changes.

## Discipline (TDD + KISS)

```text
[ ] Failing test written before implementation (or TDD exception stated with reason)
[ ] Test was seen red for the right reason, then green
[ ] One behavior per cycle, not batched
[ ] Simplest design that meets the current request
[ ] Every new abstraction/layer/dependency justified by a present-day force
[ ] Stated what was deliberately NOT built
```

## Task classification

```text
[ ] Task type identified
[ ] Blast radius identified
[ ] Primary route selected
[ ] Secondary route selected if needed
[ ] Overengineering risk considered
```

## Safe change

```text
[ ] Existing behavior understood
[ ] Behavior change separated from refactor
[ ] Smallest safe change chosen
[ ] Public contracts checked
[ ] Tests/checks identified
```

## Code quality

```text
[ ] Names reveal intent
[ ] Functions/classes are cohesive
[ ] Duplication handled thoughtfully
[ ] Abstractions justified by real pressure
[ ] Coupling did not increase unnecessarily
```

## Legacy risk

```text
[ ] Characterization tests added if needed
[ ] Seams introduced only where useful
[ ] Risky behavior protected
[ ] Broad rewrite avoided or justified
```

## Testing

```text
[ ] Unit tests
[ ] Integration tests where boundaries matter
[ ] Contract tests for public interfaces
[ ] Characterization tests for legacy behavior
[ ] Smoke/manual checks if automation unavailable
```

## Architecture

```text
[ ] Forces/tradeoffs named
[ ] Data ownership clear
[ ] Transaction/consistency boundary clear
[ ] Deployment/operability impact considered
[ ] Failure modes considered
[ ] ADR/update docs if significant
```

## Production readiness

```text
[ ] Timeouts at boundaries
[ ] Retries bounded and idempotent
[ ] Resource limits considered
[ ] Observability/logging/metrics present
[ ] Failure/recovery behavior considered
[ ] Backpressure/fallback considered if relevant
```

## Distributed systems

```text
[ ] Consistency expectations explicit
[ ] Idempotency/deduplication handled
[ ] Ordering/duplicates/replay handled
[ ] Derived data rebuild/reconciliation considered
[ ] Cross-service contracts tested
```

## Migration/contract

```text
[ ] Consumers identified
[ ] Backward compatibility checked
[ ] Version/deprecation plan if breaking
[ ] Existing data/backfill handled
[ ] Rollback or forward-fix considered
```

## Performance/security

```text
[ ] Performance measured or risk assessed
[ ] Caching/invalidation correct if added
[ ] Sensitive data handled safely
[ ] Logs do not leak secrets/PII
[ ] Access control preserved
```
