# bigbrain QA — verifying the built, running thing

The top of the test pyramid (see `rules/12-e2e-and-qa.md`). The lower layers
(unit/integration) run in `bigbrain_verify.py`; this folder is for proving the
**assembled, running** system works.

## Files
- `smoke.sample.py` — zero-dep post-deploy smoke test. Run AFTER deploy against
  the real URL; fail the deploy if it's not healthy.
- `playwright.config.sample.ts` — copy to `playwright.config.ts` to enable e2e.
  Once present, `bigbrain_verify.py` and CI run `npx playwright test`.
- `e2e/example.spec.sample.ts` — template for ONE critical journey. Copy per slice.

## Enable e2e
```bash
npm i -D @playwright/test && npx playwright install --with-deps
cp bigbrainQA/playwright.config.sample.ts playwright.config.ts
mkdir -p e2e && cp bigbrainQA/e2e/example.spec.sample.ts e2e/home.spec.ts   # make it real
python bigbrain_verify.py --only e2e
```

## The honest bit
e2e and audits are mechanical gates **once the journeys/configs exist**. The kit
wires the runners; you (or the agent) write the journey tests; a human confirms
they're real, not stubbed. Until journeys exist, the e2e step is a no-op — it
won't block a repo that hasn't adopted it yet. Keep e2e **thin**: a few
unacceptable-to-break journeys, never hundreds of brittle UI tests.

## Audits
Dependency and secret audits run in `.github/workflows/qa.yml`
(`npm audit` / `pip-audit` + gitleaks). They're cheap, mechanical, high-value.
Add Lighthouse/axe with score thresholds if you want a11y/perf gates.

## Tech debt (visibility, never a gate)
Tech debt has no checkable definition, so it can't be gated — gating on debt
proxies just teaches the agent to game them. Two soft-tier tools help instead:

- **`debt_report.py`** surfaces *proxies for where to look*: churn hot-spots
  (a real trend), large files, the hot-AND-big intersection (prime suspects),
  and TODO/FIXME/HACK/XXX markers. It analyzes your app code (it skips the kit's
  own folders) and **always exits 0**. The `debt-report` job in `qa.yml` prints
  it in the run log; it is NOT a required check.
  ```bash
  python bigbrainQA/debt_report.py --since 300 --top 15
  python bigbrainQA/debt_report.py --json .debt.json --baseline .debt-prev.json  # trend deltas
  ```
- **The debt-hawk critic** (`bigbrainReviewer/REVIEWER.md`) reviews each PR with
  one question — "this passes the checks; what will we regret?" — catching the
  unmeasurable debt (misleading names, abstractions that don't earn themselves,
  gamed checks). Advisory, fallible, a force-multiplier on the human reviewer.

Neither is a guarantee. They make debt *visible* so judgment can reach it; the
real defense is a human reviewing changes small enough to actually review.
