import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    // Keep a Windows drive alias intact when the physical path contains '#'.
    preserveSymlinks: true,
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    // PGlite allocates a PostgreSQL WASM heap per worker; keep local runs bounded.
    maxWorkers: 1,
    include: ["tests/unit/**/*.test.ts", "tests/database/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
