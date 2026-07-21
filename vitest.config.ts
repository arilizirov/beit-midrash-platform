import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["test/global-setup.ts"],
    // e2e/ belongs to Playwright. Vitest's default include matches *.spec.ts,
    // so without this it tries to run the browser journeys and fails at load.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    // DB tests share one database; parallel files would interleave truncates.
    // YAGNI: split DB tests into their own vitest project (parallelism off
    // there only) once serial runtime actually hurts — today it's 2 files.
    fileParallelism: false,
  },
});
