import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["test/global-setup.ts"],
    // DB tests share one database; parallel files would interleave truncates.
    fileParallelism: false,
  },
});
