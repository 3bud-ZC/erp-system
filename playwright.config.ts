/**
 * Playwright configuration for ERP system E2E tests.
 *
 * Run modes:
 *   - Manual: start `npm run dev` separately, then `npm run e2e`
 *   - Auto:   set E2E_AUTO_SERVER=1 to let Playwright spawn `next dev`
 *
 * Required environment (use `.env.e2e.local` or shell):
 *   E2E_BASE_URL    default: http://localhost:3000
 *   E2E_EMAIL       default: admin@erp.com
 *   E2E_PASSWORD    default: admin
 *
 * Seed prerequisite: the admin user must exist. Run `npx tsx prisma/seed-auth.ts`
 * once before the first test run.
 */

import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const AUTO_SERVER = process.env.E2E_AUTO_SERVER === '1';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false, // shared DB — keep tests sequential to avoid race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  timeout: 30_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    locale: 'ar-EG',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      // Setup hits the auth-tier rate-limit (5 req / 15 min). A retry would
      // burn another auth slot AND re-trigger the cold-compile, doubling the
      // failure budget. Single-shot only — fail fast with a clear message.
      retries: 0,
    },
    {
      name: 'chromium',
      use: {
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: /global\.setup\.ts/,
    },
  ],

  webServer: AUTO_SERVER
    ? {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
        // E2E_BYPASS_RATE_LIMIT=1 short-circuits the auth-tier rate limit (5
        // req / 15 min) which would otherwise block test runs that perform
        // multiple form-logins. The bypass is gated behind this env var; the
        // rate limit is fully active in any deployment that doesn't set it.
        env: {
          ...process.env,
          E2E_BYPASS_RATE_LIMIT: '1',
        } as Record<string, string>,
      }
    : undefined,
});
