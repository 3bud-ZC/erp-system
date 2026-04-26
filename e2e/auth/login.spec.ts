/**
 * Auth flow — login page smoke + redirect.
 *
 * The global.setup.ts already verifies that the seeded admin can log in;
 * this spec adds two negative cases (rendering + bad creds) and one positive
 * case independent of the cached storageState.
 */

import { test, expect } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from '../fixtures/credentials';

// Skip the cached admin storageState for this file — we want to test login
// against a fresh, unauthenticated context.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('login page', () => {
  test('renders email + password fields and submit button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('not-a-real-user@example.com');
    await page.locator('#password').fill('definitely-wrong');
    await page.locator('button[type="submit"]').click();

    // App renders error inside a div.bg-red-50 wrapper; just assert visibility.
    await expect(page.locator('div.bg-red-50')).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('valid credentials redirect to dashboard or onboarding', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(TEST_EMAIL);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Real app sends fresh users (no tenant) to /onboarding, returning users to /dashboard.
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });
  });
});
