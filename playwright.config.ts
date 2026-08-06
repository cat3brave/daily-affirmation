import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const host = "127.0.0.1";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://${host}:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `${npmCommand} run dev -- --hostname ${host} --port ${port}`,
    url: `http://${host}:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-placeholder-anon-key",
      GEMINI_API_KEY: "e2e-placeholder-gemini-key",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
