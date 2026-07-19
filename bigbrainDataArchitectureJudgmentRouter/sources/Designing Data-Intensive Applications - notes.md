# Designing Data-Intensive Applications — notes (original summary)

> The kit's own paraphrase of this book's key principles, to guide judgment.
> This is NOT the book's text. For depth, read the book itself.

Martin Kleppmann (shared with the software brain).

- Replication and partitioning are the axes of scaling state; each has failure modes.
- Consistency is a spectrum; choose deliberately. Logs unify many patterns.
- Reason explicitly about partial failure — that's where correctness lives.
