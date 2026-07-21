// e2e config. Once this file exists, `bigbrain_verify.py` runs Playwright as
// part of the cycle and qa.yml runs it in CI. Keep the suite THIN — a few
// critical journeys, not hundreds of brittle tests.
import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3010";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // The app is useless without its database, so e2e boots a real server
  // against a real (migrated + seeded) DB. A suite that green-lights an app
  // which never booted would prove nothing.
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/signin`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
