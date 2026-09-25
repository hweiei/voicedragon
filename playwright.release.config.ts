import { defineConfig, devices } from "@playwright/test";

/** P8-E 轻量发布矩阵：完整业务流仍由 playwright.config.ts 的 Chromium 套件守护。 */
export default defineConfig({
  testDir: "tests/release",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 1, // Bounded browser memory; CLI --workers may override for larger runners.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4175",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] }
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"] }
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"] }
    }
  ],
  webServer: {
    command: "npm run preview -- --port 4175 --strictPort",
    url: "http://localhost:4175",
    reuseExistingServer: false,
    timeout: 60_000
  }
});
