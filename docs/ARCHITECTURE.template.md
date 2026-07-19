# ARCHITECTURE.md — the birds-eye map (builder keeps this current)

The auditor reads THIS first, so it never has to read every line. Keep it short
and update it whenever structure changes. `boundaries.yaml` + the import graph
are the ground truth for connections; this file adds the human-readable "why".

## Modules
One line each: purpose + what it may depend on + which spec area it serves.

| Module | Purpose (one line) | Depends on | Spec ref |
|--------|--------------------|------------|----------|
| <e.g. features/billing> | charges and invoices a customer | platform | §Billing |
| <features/users> | identity and accounts | platform | §Accounts |
| <platform> | db, auth, queue, telemetry | (none) | — |

## Connections (the shape)
- Brief prose or a sketch of how the main pieces talk. Must match `allow:` in
  `boundaries.yaml`. If they disagree, `boundaries.yaml` wins — fix this file.

## Notes
- Anything non-obvious about the structure a new reader (or the auditor) needs.
