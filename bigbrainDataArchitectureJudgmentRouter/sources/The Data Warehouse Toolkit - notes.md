# The Data Warehouse Toolkit — notes (original summary)

> The kit's own paraphrase of this book's key principles, to guide judgment.
> This is NOT the book's text. For depth, read the book itself.

Ralph Kimball's dimensional modeling — the counterpart to Inmon.

- Model around facts (measurements) and dimensions (context); the star schema is the canonical shape.
- Declare the GRAIN of a fact table first; everything follows from it.
- Handle history with slowly changing dimension techniques (type 1/2/3).
- Conformed dimensions + the bus matrix let marts integrate across the enterprise.
