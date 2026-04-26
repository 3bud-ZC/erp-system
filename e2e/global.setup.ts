/**
 * Global setup — runs once before all spec projects.
 *
 * 1. Self-heals: if no admin user exists, runs the auth seed before logging in.
 * 2. Logs in via the real /login form using the seeded admin credentials.
 * 3. Saves the resulting cookie + localStorage (Zustand auth store) to
 *    e2e/.auth/admin.json. All other specs reuse this storageState, skipping
 *    the login round-trip.
 */

import { test as setup, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';
import { TEST_EMAIL, TEST_PASSWORD } from './fixtures/credentials';
import { assertIsolatedDatabase } from './scripts/assert-isolated-db';

// 🛡️  ENVIRONMENT ISOLATION — runs before ANY DB or HTTP activity.
// Refuses to start if DATABASE_URL points at a managed production host.
// Override with E2E_ALLOW_PRODUCTION_DB=1 (loud, explicit, never default).
assertIsolatedDatabase();

const STORAGE_PATH = path.join(__dirname, '.auth', 'admin.json');

/**
 * Safe-mode admin self-heal — never destructive against existing data.
 *
 * IMPORTANT: We deliberately do NOT run `npm run seed` here. That script
 * (prisma/seed.ts) executes `deleteMany()` against business tables (customers,
 * products, accounts, journalEntries, ...) which would WIPE the live DB on
 * every E2E run. The upsert-only `prisma/seed-auth.ts` and
 * `e2e/scripts/reset-admin-password.ts` are sufficient to guarantee:
 *   - the admin user exists with the documented password, AND
 *   - the E2E_DEFAULT tenant + base chart-of-accounts exist for that admin.
 *
 * Both scripts are idempotent and only mutate auth/role rows + the dedicated
 * E2E tenant — no other production data is touched.
 *
 * Set E2E_SKIP_SEED=1 to skip even these safe heals (run purely against
 * existing data; tests will fail-fast if admin login is broken).
 */
function ensureSeed(): void {
  if (process.env.E2E_SKIP_SEED === '1') return;
  try {
    execSync('npx tsx prisma/seed-auth.ts', { stdio: 'ignore', timeout: 30_000 });
  } catch {
    // ignore — login below will fail informatively if the user truly missing
  }
  try {
    execSync('npx tsx e2e/scripts/reset-admin-password.ts', {
      stdio: 'ignore',
      timeout: 30_000,
      env: process.env,
    });
  } catch {
    // ignore
  }
}

/**
 * Pre-warm Next.js dev-mode cold-compile for the /login PAGE bundle.
 *
 * IMPORTANT: we deliberately do NOT pre-hit /api/auth/login. The auth tier
 * rate-limit is 5 requests / 15 minutes per IP (lib/middleware/global-security.ts),
 * and any POST — even with bogus creds — counts. The real attemptLogin()
 * below will compile the route on its first call; we just give it a more
 * generous response timeout to absorb the cold-compile.
 */
async function prewarm(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 120_000 });
}

async function attemptLogin(
  page: import('@playwright/test').Page
): Promise<{ ok: boolean; reason?: string }> {
  // Use 'load' (full page load) not 'domcontentloaded' so React has time to
  // hydrate before we interact. Prior `fill()` against the SSR'd-but-not-yet-
  // hydrated input was firing the native input event but React hadn't attached
  // its onChange listener yet — state stayed at '' and the form submitted empty.
  await page.goto('/login', { waitUntil: 'load', timeout: 60_000 });

  // Wait for hydration: the React state-bound input responds to focus changes
  // only once the listener is wired. We click first to force focus, then type.
  // This is more reliable than `fill()` for state-controlled inputs in dev.
  const emailField = page.locator('#email');
  const passwordField = page.locator('#password');
  await emailField.waitFor({ state: 'visible', timeout: 30_000 });
  await emailField.click();
  await emailField.fill(TEST_EMAIL);
  await passwordField.click();
  await passwordField.fill(TEST_PASSWORD);

  // Sanity assert: the inputs actually contain what we typed
  await expect(emailField).toHaveValue(TEST_EMAIL);
  await expect(passwordField).toHaveValue(TEST_PASSWORD);

  // Wait for the actual /api/auth/login response (proves auth pipeline answered),
  // then for the client-side redirect to settle. The 90s budget absorbs the
  // first-time cold-compile of the auth route in dev mode.
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    { timeout: 90_000 }
  );

  await page.locator('button[type="submit"]').click();

  let resp;
  try {
    resp = await respPromise;
  } catch {
    return { ok: false, reason: 'no /api/auth/login response within 90s (dev-server cold-compile?)' };
  }

  // 429 → rate limit. The webServer was reused from a previous test run with a
  // hot rate-limit window. Restart the dev server to clear the in-memory store,
  // OR wait 15 minutes. Surface a clear message instead of a generic timeout.
  if (resp.status() === 429) {
    return {
      ok: false,
      reason:
        'auth tier rate-limited (429). The webServer reused a hot bucket from a previous run. ' +
        'Restart the server (kill port 3000) or wait 15 minutes; see lib/middleware/global-security.ts RATE_LIMITS.auth.',
    };
  }

  if (!resp.ok()) {
    return { ok: false, reason: `auth API returned ${resp.status()}` };
  }

  // Auth succeeded server-side. Now wait for the client redirect to land on
  // /dashboard or /onboarding. Generous budget — hydration can be slow on
  // first dev-mode pageload.
  try {
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
    return { ok: true };
  } catch {
    return { ok: false, reason: `redirect did not occur; landed on ${page.url()}` };
  }
}

setup('authenticate as admin', async ({ page, context }) => {
  // Generous budget: cold dev-server compile of /login + /api/auth/login + a
  // possible seed run + a retry login can each take 30-60s the first time.
  setup.setTimeout(300_000);

  // CRITICAL: intercept /api/auth/me and /api/auth/check-session.
  // The unauthenticated /login page polls these on every page load. They are
  // auth-tier rate-limited (5 req / 15 min per IP, see lib/middleware/global-security.ts).
  // Two page navigations × ~2 polls × React StrictMode duplication = 8 hits → 429.
  // The login form submit then can't reach the route handler. Returning a cheap
  // 401 from the test runner side bypasses the server entirely and preserves
  // the auth-tier budget for the actual /api/auth/login POST.
  await context.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"success":false}' })
  );
  await context.route('**/api/auth/check-session', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"success":false}' })
  );

  // ALWAYS seed + reset password before the timed login. Both operations are
  // idempotent and fast (< 5s when the data already exists); doing them
  // unconditionally avoids wasting an auth-tier rate-limit slot on a first
  // login that will inevitably fail with a stale-hash 401.
  ensureSeed();

  // Pre-compile the /login page so the timed login below isn't racing the
  // bundler for the page itself.
  await prewarm(page);

  const result = await attemptLogin(page);
  expect(
    result.ok,
    `Login failed: ${result.reason ?? 'unknown'}`
  ).toBe(true);

  await expect(page.locator('div.bg-red-50')).toHaveCount(0);
  await page.context().storageState({ path: STORAGE_PATH });
});
