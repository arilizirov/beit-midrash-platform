# 07 Architecture Tradeoffs

Use for architecture decisions, boundaries, modularity, service splits, coupling, deployability, and hard tradeoffs.

Primary source: _Software Architecture: The Hard Parts_
Secondary sources: _An Elegant Puzzle_, _DDIA_, _Release It!_

## Core judgment

Architecture is tradeoff analysis under constraints. There is no free architecture. Every decision optimizes some forces and worsens others.

## Triggers

- monolith vs microservices
- module/service boundary change
- architecture proposal
- high coupling
- team ownership issue
- distributed transaction concern
- deployment independence
- scaling boundary

## Rules

- Identify forces: change frequency, team ownership, data ownership, transaction consistency, latency, deployability, scalability, operability, security, cost, cognitive load.
- KISS: choose the simplest design that satisfies current forces; the burden of proof is on added complexity, not on simplicity. Every abstraction, layer, service, or dependency must be paid for by a force that exists today.
- Name the tradeoff: what improves and what worsens.
- Keep boundaries around business capabilities and data ownership.
- Prefer modular monolith before distributed services unless distribution is justified.
- Defer irreversible complexity when uncertainty is high.
- Document significant decisions ADR-style.

## Boundaries must be enforced mechanically, not socially

A boundary that lives only in a doc, a review comment, or an agent's good
intentions is not a boundary — it is a suggestion, and it erodes. Judgment
decides *where* the line goes; a machine keeps it there.

- Express module boundaries as a checked-in policy (`boundaries.yaml`) and
  enforce them with a real dependency-graph check (`bigbrainBoundaryGuard`,
  which wraps dependency-cruiser / import-linter / tach) wired into **CI under
  branch protection**. Generic `lint`/`test` do not check the dependency graph.
- Enforce both directions of a boundary: the **allowlist** (who may depend on
  whom, deny by default) and the **public surface** (others may enter a module
  only through its public entrypoints, never its internals).
- An LLM coding agent is an **untrusted committer**. Its self-report ("I
  respected the boundary") is not a gate; only a check it cannot bypass or
  disable is. Put the gate outside the actor — on the git host — and scope the
  agent's token so it cannot weaken the rule. See `BRANCH_PROTECTION.md`.
- Treat boundaries as **provisional**: you discover the right lines by building,
  and the first cut is often wrong. Keep them cheap to move (behavior-focused
  tests, reversible steps) and change them deliberately via a `boundaries.yaml`
  PR + ADR — never by routing around the check.

## Verification

- architecture decision record
- dependency/coupling review
- data ownership review
- contract tests across boundaries
- deployment/runtime impact review
- failure mode review
- team ownership review

## Anti-patterns

Do not use microservices to fix messy code, split services without data ownership boundaries, add queues to hide unclear ownership, choose architecture by fashion, or claim an option has no tradeoffs. Do not rely on prose, review comments, or an agent's promise as a boundary gate; do not let the actor that writes the code also be the actor that can disable the check; do not widen the allowlist in `boundaries.yaml` to sneak a dependency through instead of rethinking the design.
