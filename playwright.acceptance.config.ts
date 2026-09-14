import { defineConfig, devices } from "@playwright/test";

if (process.env.ACCEPTANCE_TEST_MODE !== "true")
  throw new Error("Authenticated acceptance is disabled.");
if (!process.env.ACCEPTANCE_BASE_URL?.startsWith("https://"))
  throw new Error("Authenticated acceptance requires an HTTPS base URL.");

export default defineConfig({
  testDir: "./acceptance/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ["line"],
    ["json", { outputFile: "artifacts/acceptance-playwright-results.json" }],
  ],
  outputDir: "artifacts/acceptance-playwright-output",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.ACCEPTANCE_BASE_URL,
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
});
