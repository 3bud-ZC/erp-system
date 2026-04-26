/**
 * Global setup — runs once before all spec projects.
 * Logs in via the real /login form and saves the resulting cookie + localStorage
 * (Zustand auth store) to e2e/.auth/admin.json.
 *
 * All other specs reuse this storageState, skipping the login round-trip.
 */

import { test as setup, expect } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from './fixtures/credentials';
import * as path from 'path';

const STORAGE_PATH = path.join(__dirname, '.auth', 'admin.json');

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');

  // Login page uses id-based selectors (not name="email")
  await page.locator('#email').fill(TEST_EMAIL);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();

  // After successful login: redirects to /dashboard (existing tenant) or /onboarding (new user)
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });

  // Sanity check — ensure no error banner is showing
  const errorBanner = page.locator('div.bg-red-50');
  await expect(errorBanner).toHaveCount(0);

  await page.context().storageState({ path: STORAGE_PATH });
});
