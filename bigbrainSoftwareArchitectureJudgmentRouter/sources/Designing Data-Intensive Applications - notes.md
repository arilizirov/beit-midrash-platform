# Designing Data-Intensive Applications — notes (original summary)

> The kit's own paraphrase of this book's key principles, to guide judgment.
> This is NOT the book's text. For depth, read the book itself.

Martin Kleppmann's map of data systems, organised around reliability, scalability, maintainability.

- Replication and partitioning are the two axes of scaling state; each has failure modes.
- Consistency is a spectrum (linearizable → eventual); pick deliberately, know the tradeoffs.
- Logs/event streams unify many patterns; derived data should be reproducible from a source of truth.
- Reason explicitly about what happens under partial failure — that's where correctness is won or lost.
