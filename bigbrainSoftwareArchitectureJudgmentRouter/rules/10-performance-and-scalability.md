# 10 Performance and Scalability

Use for slow paths, scaling concerns, resource use, load, caching, batching, concurrency, and performance-sensitive changes.

Primary sources: _Release It!_, _Designing Data-Intensive Applications_

## Core judgment

Performance work should be driven by measurement and expected workload. Scalability requires controlling resource usage and failure behavior, not just making code faster.

## Triggers

- slow API/query/job
- high traffic path
- large data volume
- memory/CPU/connection issues
- user asks to optimize
- adding cache
- concurrency/parallelism
- scaling architecture

## Rules

- Measure before optimizing when possible.
- Optimize the bottleneck.
- Bound timeouts, concurrency, queue size, batch size, memory, connections, threads, and request size.
- Cache only with source of truth, invalidation/TTL, staleness tolerance, failure behavior, and rebuild strategy.
- Avoid N+1 queries, unbounded scans, repeated expensive work, and unnecessary serialization.
- Use backpressure, rate limits, load shedding, circuit breakers, and graceful degradation when appropriate.

## Verification

- benchmark/profile
- query plan review
- load test
- regression performance test
- resource monitoring
- cache correctness tests
- N+1 tests/log review
- overload/failure test

## Anti-patterns

Do not optimize without evidence in complex systems, add cache without invalidation/freshness plan, parallelize unbounded work, increase timeouts to hide slowness, ignore resource limits, or make architecture more complex for hypothetical scale.
