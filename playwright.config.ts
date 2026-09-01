import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

/**
 * Central Playwright configuration for the AI-Augmented Playwright Test Suite.
 *
 * In the real Capgemini/CyPost-style setup this file would branch per market
 * (US, UK, Germany, Portugal, Canada) via env vars (MARKET, BASE_URL, LOCALE).
 * Here it targets a fictional demo POS/kiosk app so the suite runs standalone.
 */
const PORT = Number(process.env.STATIC_SERVER_PORT ?? 4173);

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/playwright-report.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  webServer: {
    command: 'tsx scripts/static-server.ts',
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: process.env.LOCALE ?? 'en-US',
    // Optional escape hatch for environments with their own Chromium build
    // (locked-down CI images, corporate images, etc.) instead of the one
    // `npx playwright install` downloads.
    ...(process.env.PW_CHROMIUM_EXECUTABLE_PATH
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_EXECUTABLE_PATH } }
      : {}),
  },
  projects: [
    {
      name: 'chromium-us',
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
    },
    {
      name: 'chromium-uk',
      use: { ...devices['Desktop Chrome'], locale: 'en-GB' },
    },
    {
      name: 'chromium-de',
      use: { ...devices['Desktop Chrome'], locale: 'de-DE' },
    },
  ],
});