/**
 * Helpers for navigating to authenticated routes in chromium specs.
 *
 * WHY gotoAuthenticated USES FORM-LOGIN + SPA NAVIGATION
 * ------------------------------------------------------
 * The dashboard layout (app/(dashboard)/layout.tsx) gates access via:
 *
 *   const { isAuthenticated } = useAuthStore();
 *   useEffect(() => { if (!isAuthenticated) router.push('/login'); }, [...]);
 *
 * `useAuthStore` is a Zustand v5 store using `useSyncExternalStore` under the
 * hood. By design, useSyncExternalStore returns the SERVER snapshot during
 * initial client hydration to avoid hydration mismatches. Server-rendered
 * Zustand has the default state (`isAuthenticated: false`) because there is
 * no localStorage on the server. The layout's `useEffect` therefore fires
 * with `false` and redirects to /login BEFORE Zustand exposes the hydrated
 * client state. Production users never hit this — they always arrive at
 * /dashboard via the form-login flow which sets the store synchronously
 * via `setState({ isAuthenticated: true })` BEFORE the redirect to /dashboard.
 *
 * The only reliable way to put the test in the same well-behaved state as a
 * production user is to mimic that flow:
 *   1. Navigate to /login (always renders, no auth gate).
 *   2. Form-submit credentials. Login route returns 200, the LoginPage's
 *      onSubmit calls Zustand's setState synchronously, then router.replace
 *      to /dashboard. Zustand state is now correct in memory.
 *   3. SPA-navigate (click an <a> Link or sidebar entry) to the test target.
 *      SPA navigation preserves the JS context, so the in-memory Zustand
 *      state survives. The dashboard layout sees isAuthenticated=true and
 *      never redirects.
 *
 * Each test logs in once. The auth-tier rate limit (5 req / 15 min) is
 * defeated by setting `E2E_BYPASS_RATE_LIMIT=1` on the dev server (see
 * playwright.config.ts webServer.env). Production deployments do not set
 * this env var; the rate limit remains fully enforced there.
 *
 * WHY installAuthMeIntercept EXISTS
 * ---------------------------------
 * `components/providers/AppProviders.tsx` polls /api/auth/me on every mount.
 * Even with rate-limit bypass we keep the intercept to make tests faster and
 * deterministic — no real DB roundtrip on every page load.
 */

import { expect, type BrowserContext, type Page } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from './credentials';

/**
 * Form-login on the /login page. Uses the click+fill hydration-safe pattern.
 * Returns once the auth API responds 200 and the redirect to /dashboard or
 * /onboarding has settled.
 */
async function formLogin(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'load' });

  const emailField = page.locator('#email');
  const passwordField = page.locator('#password');
  await emailField.waitFor({ state: 'visible' });
  await emailField.click();
  await emailField.fill(TEST_EMAIL);
  await passwordField.click();
  await passwordField.fill(TEST_PASSWORD);

  // Wait for the actual /api/auth/login response — proves the form actually
  // submitted (no empty-body race).
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    { timeout: 60_000 }
  );
  await page.locator('button[type="submit"]').click();
  const resp = await respPromise;
  expect(resp.status(), 'login API should accept admin credentials').toBe(200);

  // Wait for the post-login client-side redirect to land on /dashboard or
  // /onboarding. This proves the LoginPage's setState({ isAuthenticated: true })
  // has run and the in-memory Zustand store is correct.
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
}

/**
 * Click a Next.js <Link>-rendered anchor matching the given href. SPA nav,
 * preserves the JS context so Zustand state survives. Returns once the URL
 * matches the expected destination.
 *
 * If no direct anchor exists on the current page, walks up the URL path one
 * segment at a time — clicking the longest prefix anchor we can find — and
 * then clicks the deeper anchor on that page. Handles cases like
 * /sales/invoices/new (sidebar has /sales/invoices; the "+ فاتورة جديدة"
 * link to /sales/invoices/new is on that page).
 */
async function spaNavigate(page: Page, url: string): Promise<void> {
  // Try direct anchor first.
  const direct = page.locator(`a[href="${url}"]`).first();
  if ((await direct.count()) > 0) {
    await direct.click();
    await page.waitForURL((u) => u.pathname === url || u.pathname + u.search === url, {
      timeout: 30_000,
    });
    return;
  }

  // Walk parent paths until we find an anchor we can click.
  const segments = url.split('/').filter(Boolean);
  for (let i = segments.length - 1; i > 0; i--) {
    const parent = '/' + segments.slice(0, i).join('/');
    const parentLink = page.locator(`a[href="${parent}"]`).first();
    if ((await parentLink.count()) > 0) {
      await parentLink.click();
      await page.waitForURL((u) => u.pathname === parent, { timeout: 30_000 });
      // Now look for the deeper anchor on the parent page.
      const deep = page.locator(`a[href="${url}"]`).first();
      await deep.waitFor({ state: 'visible', timeout: 15_000 });
      await deep.click();
      await page.waitForURL((u) => u.pathname === url, { timeout: 30_000 });
      return;
    }
  }

  throw new Error(
    `spaNavigate: no clickable <a href> path from current page (${page.url()}) ` +
      `down to ${url}. Add the link to the sidebar or a parent page.`
  );
}

/**
 * Navigate to an authenticated route by form-logging-in then SPA-navigating.
 * See the file header for why this is the only reliable strategy.
 */
export async function gotoAuthenticated(page: Page, url: string): Promise<void> {
  await formLogin(page);
  await spaNavigate(page, url);
}

/**
 * Static admin-user payload used to fulfil intercepted /api/auth/me calls.
 *
 * Mirrors the shape returned by the real route — only fields actually consumed
 * by `components/providers/AppProviders.tsx` are populated. Keeping this in
 * sync with prisma/seed-auth.ts is sufficient for E2E.
 */
const ADMIN_ME_RESPONSE = {
  success: true,
  data: {
    user: {
      id: 'e2e-admin',
      email: 'admin@erp.com',
      name: 'System Administrator',
      roles: ['admin'],
      permissions: ['view_dashboard', 'create_customer', 'create_product', 'create_sales_invoice'],
    },
  },
};

const ONBOARDING_RESPONSE = {
  success: true,
  data: {
    settings: {
      brandColor: '#2563eb',
      companyName: 'E2E Test Co',
      companyNameAr: 'شركة الاختبار',
    },
  },
};

/**
 * Intercept /api/auth/me, /api/auth/check-session, and /api/onboarding so
 * AppProviders' on-mount polling never reaches the real (rate-limited) auth
 * tier. Apply in a beforeEach to every chromium spec via installAuthFixtures.
 */
export async function installAuthMeIntercept(context: BrowserContext): Promise<void> {
  await context.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ADMIN_ME_RESPONSE),
    })
  );
  await context.route('**/api/auth/check-session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  );
  await context.route('**/api/onboarding', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ONBOARDING_RESPONSE),
    })
  );
}
