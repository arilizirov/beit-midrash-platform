# Modeling the Agile Data Warehouse with Data Vault — notes (original summary)

> The kit's own paraphrase of this book's key principles, to guide judgment.
> This is NOT the book's text. For depth, read the book itself.

Dan Linstedt's Data Vault 2.0 modeling approach.

- Hubs = business keys; Links = relationships; Satellites = descriptive, time-variant attributes.
- Separating keys, relationships, and attributes makes the model auditable and resilient to change.
- Built for incremental, parallel loading and full historical traceability.
