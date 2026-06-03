import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ["src/main/**", "node"],
      ["src/shared/**", "node"],
    ],
    environment: "jsdom",
    setupFiles: ["src/renderer/src/setup-tests.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
