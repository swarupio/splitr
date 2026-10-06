import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile-chromium",
      use: { browserName: "chromium", viewport: { width: 360, height: 800 } },
    },
    {
      name: "desktop-chromium",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_Y2xlcmsuZXhhbXBsZS50ZXN0JA==",
      CLERK_SECRET_KEY: "sk_test_placeholder",
      NEXT_PUBLIC_CONVEX_URL: "https://placeholder.convex.cloud",
      CONVEX_HTTP_URL: "https://placeholder.convex.site",
      INNGEST_BRIDGE_SECRET: "placeholder-for-tests-only",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
