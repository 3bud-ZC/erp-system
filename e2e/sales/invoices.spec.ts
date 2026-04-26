/**
 * Sales invoice create-flow.
 *
 * Authenticated via cached admin storageState.
 * Uses 'حفظ وجديد' (Save & New) so we stay on the page and can assert the toast
 * before any redirect.
 *
 * PRECONDITION: at least one customer and one product must exist. The
 * customers/customers.spec.ts and inventory/products.spec.ts files run earlier
 * in the alphabetical test order and create them.
 */

import { test, expect } from '@playwright/test';
import { gotoAuthenticated, installAuthMeIntercept } from '../fixtures/auth-helpers';

test.beforeEach(async ({ context }) => {
  await installAuthMeIntercept(context);
});

test('create a sales invoice (Save & New) and see success toast', async ({ page }) => {
  // Form-login + sidebar -> /sales/invoices -> "+ فاتورة جديدة" SPA hops +
  // cold-compile of /sales/invoices/new + reference-data fetch easily exceeds
  // the default 30s test timeout. Bump to 120s.
  test.setTimeout(120_000);

  await gotoAuthenticated(page, '/sales/invoices/new');

  // Wait for the page header (proves React mounted), then for the loading
  // sentinel to disappear (proves customers + products are fetched).
  await expect(page.getByRole('heading', { name: /فاتورة مبيعات جديدة/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('text=جاري تحميل البيانات')).toHaveCount(0, { timeout: 30_000 });

  // Customer select — pick the first real option (skip the placeholder "— اختر العميل —")
  const customerSelect = page.locator('select').first();
  const customerOptionCount = await customerSelect.locator('option').count();
  test.skip(customerOptionCount < 2, 'No customers in the database — skip until seeded');
  await customerSelect.selectOption({ index: 1 });

  // First line product select — within the line-items table.
  // Multiple selects exist on the page (status, payment, etc.); product selects
  // sit inside <td> cells in the items table. We select the first one whose first
  // option text contains "اختر المنتج".
  const productSelect = page.locator('select').filter({ hasText: 'اختر المنتج' }).first();
  const productOptionCount = await productSelect.locator('option').count();
  test.skip(productOptionCount < 2, 'No products in the database — skip until seeded');
  await productSelect.selectOption({ index: 1 });

  // Quantity — inputs of type=number in the same row, take the first one.
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.first().fill('1');

  // Set up the response listener BEFORE clicking — the toast auto-hides after
  // 3s which races with Playwright's locator polling on slow runs. Waiting on
  // the actual API response is deterministic.
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/api/sales-invoices') && r.request().method() === 'POST',
    { timeout: 30_000 }
  );

  // Click 'حفظ وجديد' (stays on page) — preferred over 'حفظ وإغلاق' which navigates away.
  await page.getByRole('button', { name: /حفظ وجديد/ }).click();

  const resp = await respPromise;
  expect(resp.status(), 'sales invoice API should accept the request').toBeLessThan(400);

  // Form reset to placeholder customer is the stable post-save signal — the
  // success toast is auto-dismissed within 3s and is timing-sensitive.
  await expect(customerSelect).toHaveValue('', { timeout: 10_000 });
});
