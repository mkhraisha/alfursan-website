import { defineConfig, devices } from "playwright/test";
import { assertLocalE2ETarget } from "./src/lib/e2e-target-guard";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

// Refuses to run this entire suite against a non-local target — most
// importantly, production (see src/lib/e2e-target-guard.ts). This throws
// synchronously while the config module loads, aborting `playwright test`
// before a single spec file runs, so no test — current or future — can
// bypass it. Local runs can opt in with E2E_ALLOW_NON_LOCAL=1; CI never can.
assertLocalE2ETarget(baseURL, {
  isCI: !!process.env.CI,
  allowNonLocal: !!process.env.E2E_ALLOW_NON_LOCAL,
});

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start the dev server automatically when running locally
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:4321",
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
