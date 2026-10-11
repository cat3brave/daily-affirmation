import { defineConfig, devices } from "@playwright/test";

if (process.env.E2E_PROD_READY !== "true") {
  throw new Error("Run production smoke tests with npm run e2e:prod (fresh build required).");
}

export default defineConfig({
  testDir: "./e2e-prod",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: "list",
  outputDir: "test-results/production",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    baseURL: "http://127.0.0.1:3200",
    timezoneId: "Asia/Tokyo",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
