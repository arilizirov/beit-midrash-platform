# Release It — notes (original summary)

> The kit's own paraphrase of this book's key principles, to guide judgment.
> This is NOT the book's text. For depth, read the book itself.

Michael Nygard on surviving production. Systems fail; design so failures don't cascade.

- Stability patterns: timeouts on every remote call, circuit breakers, bulkheads (isolation), steady-state.
- Antipatterns: unbounded resources, blocking threads, cascading failure, retry storms.
- Integration points are the #1 source of instability — wrap and guard them.
- Design for operations from day one: health checks, structured logs, backpressure, graceful degradation.
