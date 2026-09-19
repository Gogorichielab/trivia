// Playwright drives the real pages in a real browser, because CI checking that
// files parse is not the same as the game playing. See AGENTS.md "Testing".
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      // The church laptops drive a 1920x1080 TV; test at that size.
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        // CHROMIUM_PATH lets a sandbox with a pre-installed browser skip the
        // download. CI leaves it unset and uses Playwright's own chromium.
        ...(process.env.CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    command: "python3 -m http.server 8000",
    url: "http://127.0.0.1:8000",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
  },
});
