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

// Stub /api/auth/me + check-session as 401 so the unauthenticated /login page
// doesn't burn the auth-tier rate-limit budget on its mount-polling
// (5 requests / 15 min, see lib/middleware/global-security.ts).
test.beforeEach(async ({ context }) => {
  await context.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"success":false}' })
  );
  await context.route('**/api/auth/check-session', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"success":false}' })
  );
});

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
    // /api/auth/me intercept already installed by file-level beforeEach.

    // Wait for full load + click before fill — the bare fill() loses the React
    // hydration race in Next.js dev mode and the form submits empty.
    // See e2e/global.setup.ts for the same pattern.
    await page.goto('/login', { waitUntil: 'load' });
    const emailField = page.locator('#email');
    const passwordField = page.locator('#password');
    await emailField.waitFor({ state: 'visible' });
    await emailField.click();
    await emailField.fill(TEST_EMAIL);
    await passwordField.click();
    await passwordField.fill(TEST_PASSWORD);
    await expect(emailField).toHaveValue(TEST_EMAIL);
    await expect(passwordField).toHaveValue(TEST_PASSWORD);

    const respPromise = page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      { timeout: 30_000 }
    );
    await page.locator('button[type="submit"]').click();
    const resp = await respPromise;
    expect(resp.status(), 'login API should return 200').toBe(200);

    // Real app sends fresh users (no tenant) to /onboarding, returning users to /dashboard.
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
  });
});
