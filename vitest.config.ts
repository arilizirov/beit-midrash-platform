import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["test/global-setup.ts"],
    // DB tests share one database; parallel files would interleave truncates.
    // YAGNI: split DB tests into their own vitest project (parallelism off
    // there only) once serial runtime actually hurts — today it's 2 files.
    fileParallelism: false,
  },
});
