import { defineConfig } from "@playwright/test";

/**
 * Runs against a built app and the local stack from scripts/local-supabase.sh.
 * Start both first:
 *
 *   bash scripts/local-supabase.sh
 *   pnpm build && pnpm start -p 3100
 *   pnpm test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "off",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
      args: ["--proxy-bypass-list=<-loopback>"],
    },
  },
});
