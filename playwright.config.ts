import { defineConfig } from "@playwright/test";

// Tests share one database, so they run one at a time; each test resets data first.
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5180",
    // Headless Chrome's default UA contains "HeadlessChrome", which our bot filter
    // (correctly) flags. Tests present a normal desktop UA.
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  },
  webServer: [
    { command: "npm run build:pixel && npm --prefix server start", port: 4180, reuseExistingServer: !process.env.CI },
    { command: "npm --prefix web run dev", port: 5180, reuseExistingServer: !process.env.CI },
  ],
});
