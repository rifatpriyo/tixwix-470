import { defineConfig, devices } from "@playwright/test";

// Opt-in against the configured development project. Test-only users are removed.
export default defineConfig({
  testDir: "./tests/e2e-live",
  workers: 1,
  timeout: 90000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3000",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    env: { APP_URL: "http://127.0.0.1:3000" },
    reuseExistingServer: false,
    timeout: 60000,
  },
});
