# Building the Data Warehouse — notes (original summary)

> The kit's own paraphrase of this book's key principles, to guide judgment.
> This is NOT the book's text. For depth, read the book itself.

Bill Inmon's foundational warehouse view (the Corporate Information Factory lineage).

- A warehouse is subject-oriented, integrated, time-variant, and nonvolatile.
- Favour a normalized, integrated enterprise layer as the single source of truth; marts derive from it.
- Granularity is the central design choice; ETL integrates and cleanses on the way in.
