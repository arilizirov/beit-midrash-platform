// playwright.config.sample.ts — copy to playwright.config.ts to enable e2e.
//
// Once a playwright.config.* exists at the repo root, `bigbrain_verify.py`
// runs `npx playwright test` as part of the cycle, and qa.yml runs it in CI.
// Keep the suite THIN — a few critical journeys, not hundreds of brittle tests.
//
// Setup:
//   npm i -D @playwright/test && npx playwright install --with-deps
//   cp playwright.config.sample.ts playwright.config.ts
//   put specs in e2e/  (see e2e/example.spec.sample.ts)

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
