import { defineConfig } from "vitest/config";
import config from "./vitest.config";
export default defineConfig({
  ...config,
  test: {
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
