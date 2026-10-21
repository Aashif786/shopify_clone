import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

// Load .env if present
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Ignore if already loaded
  }
}

/**
 * Playwright E2E configuration for Shopify Clone.
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  /* Maximum time one test can run for */
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  /* Run tests sequentially to avoid database race conditions */
  fullyParallel: false,
  workers: 1,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: Boolean(process.env.CI),
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Reporter to use */
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000",
    /* Collect trace when retrying the failed test */
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    /* To enable Firefox and WebKit, install browser binaries with
     * `pnpm exec playwright install firefox webkit` and uncomment:
     *
     * {
     *   name: "firefox",
     *   use: { ...devices["Desktop Firefox"] },
     * },
     * {
     *   name: "webkit",
     *   use: { ...devices["Desktop Safari"] },
     * },
     */
  ],

  /* Run local dev server before starting the tests if not already running */
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
