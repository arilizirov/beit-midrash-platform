# 12 End-to-End & QA (verifying the built, running thing)

Use when a feature is built and you need to confirm the **assembled, running**
system works — not just that units pass. This is the top of the test pyramid and
the thing that proves a vertical slice is real.

Primary source: _Growing Object-Oriented Software, Guided by Tests_ (the walking
skeleton is exercised by an end-to-end test); reinforced by _Release It!_
(production failure modes) and the testing rule (`rules/04`).

## Core judgment

Unit and integration tests check the bricks and the mortar; e2e checks that you
can walk through the house. Keep e2e **thin** — a handful of critical journeys,
not hundreds of brittle UI tests. A vertical slice is not done until one real
journey passes end to end against the running system. After deploy, a tiny smoke
test confirms the real environment came up working. Audits (dependencies,
secrets, accessibility, performance) are cheap mechanical gates — wire them.

## Triggers

- a vertical slice or feature is built and needs end-to-end proof
- "is it actually working" / "QA" / "test the whole flow" requests
- pre-release / pre-deploy verification
- recurring production incidents that unit tests didn't catch

## Rules

- **Thin e2e.** Cover the few journeys whose breakage is unacceptable (sign-up, pay, core workflow). Each e2e test is expensive and flaky-prone; resist breadth. The kit's own warning: not 700 brittle UI tests.
- **Real running system.** e2e drives a real browser (Playwright/Cypress) or hits the real running API. No stubs at the layers you're trying to prove.
- **A slice isn't done until one journey is green end to end.** Wire e2e into the cycle (`bigbrain_verify.py` runs it when a Playwright config is present).
- **Smoke-test after deploy.** A tiny set against the real URL — health check + can-log-in + one core flow — catches "built fine, came up broken." (`bigbrainQA/smoke.sample.py`.)
- **Audits as gates, not afterthoughts.** Dependency audit (`npm audit` / `pip-audit`), secret scan (gitleaks), and optionally accessibility/performance (axe/Lighthouse) with thresholds. Cheap, mechanical, high-value.
- **Prefer the cheapest layer that can catch a failure.** Push logic down to unit/integration; reserve e2e for genuinely end-to-end concerns.

## Hard once armed (be honest)

e2e and audits are mechanical gates **once the tests/configs exist**. The kit
wires the *runners*; the agent writes the *journey tests*; a human confirms they
are real and not stubbed. Until journeys are written, the e2e gate is a no-op —
say so rather than implying coverage you don't have.

## Verification

- one critical journey passes end to end against the running system
- a post-deploy smoke test passes against the real environment
- dependency audit and secret scan are green in CI

## Anti-patterns

Do not write hundreds of brittle UI tests; do not stub the layer you're trying to prove; do not call a slice "done" with only unit tests; do not skip the post-deploy smoke test; do not treat dependency/secret audits as optional.
