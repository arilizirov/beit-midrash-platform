# 05 Production Readiness

Use for production-facing code, reliability, APIs, external calls, resource use, failures, operations, and deployment safety.

Primary source: _Release It!_
Secondary sources: _DDIA_, _Software Architecture: The Hard Parts_

## Core judgment

Production systems fail through latency, overload, resource exhaustion, dependency failures, retries, bad inputs, partial outages, and hidden coupling. Design for failure before it happens.

## Triggers

- external service/database/API call
- retry logic
- missing timeout
- thread/connection/resource pool
- background job
- queue/stream
- high traffic path
- deployment/runtime concern
- incident-prone code

## Rules

- Timeouts are mandatory at network, DB, queue, HTTP, RPC, and external boundaries.
- Retries require max attempts, backoff/jitter, idempotency, and error classification.
- Prevent cascading failure with bulkheads, circuit breakers, backpressure, isolation, and graceful degradation where justified.
- Protect finite resources: threads, connections, memory, file handles, queues, CPU, disk.
- Make failure visible with logs, metrics, traces, alerts, health checks, and useful error context.
- Jobs/workflows need restart/rerun/recovery behavior.

## Verification

- timeout tests/config checks
- retry/idempotency tests
- failure injection/manual simulation
- load/resource tests where relevant
- observability review
- health check review
- deployment smoke test

## Anti-patterns

Do not call external systems without timeouts, retry non-idempotent operations blindly, allow unbounded queues/pools, log errors without actionable context, or ignore partial failure paths.
