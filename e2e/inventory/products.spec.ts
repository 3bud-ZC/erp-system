/**
 * Inventory products create-flow.
 *
 * Authenticated via cached admin storageState.
 * After Phase 4 the products page reads through TanStack Query; mutation
 * triggers invalidateQueries and the new row should appear without manual reload.
 */

import { test, expect } from '@playwright/test';
import { runId } from '../fixtures/credentials';
import { gotoAuthenticated, installAuthMeIntercept } from '../fixtures/auth-helpers';
import { inputByLabelText } from '../fixtures/form-helpers';

test.beforeEach(async ({ context }) => {
  await installAuthMeIntercept(context);
});

test('create a product and see it in the table', async ({ page }) => {
  test.setTimeout(90_000);

  const code = `E2E-PRD-${runId()}`;
  const nameAr = `منتج اختبار ${code}`;

  await gotoAuthenticated(page, '/inventory/products');

  // Wait for page header instead of networkidle (TanStack Query never settles).
  await expect(page.getByRole('heading', { name: /المنتجات/ }).first()).toBeVisible({ timeout: 30_000 });

  // Open the "Add product" modal — button label "إضافة منتج"
  await page.getByRole('button', { name: /إضافة منتج/ }).first().click();
  await expect(page.getByRole('heading', { name: /إضافة منتج جديد/ })).toBeVisible();

  // Scope to the modal — page also has a search input with similar labeling.
  const modal = page.locator('div').filter({ hasText: /^إضافة منتج جديد/ }).first();

  // The product form's <label>s aren't linked to <input>s via htmlFor/id, so
  // we use inputByLabelText to walk siblings. Stock is set to 10 so the
  // downstream sales-invoice spec can sell 1 unit without hitting the
  // "stock insufficient" validation.
  await inputByLabelText(modal, /^الرمز/).fill(code);
  await inputByLabelText(modal, /الاسم بالعربية/).fill(nameAr);
  await inputByLabelText(modal, /سعر البيع/).fill('100');
  await inputByLabelText(modal, /المخزون الابتدائي/).fill('10');

  // Wait on API response — toast auto-hides too quickly to assert reliably
  // and `text=code` violates strict mode because the nameAr column also
  // contains the code substring ("منتج اختبار E2E-PRD-...").
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/api/products') && r.request().method() === 'POST',
    { timeout: 30_000 }
  );

  // Submit
  await page.getByRole('button', { name: /^حفظ$/ }).click();

  const resp = await respPromise;
  expect(resp.status(), 'products API should accept the request').toBeLessThan(400);

  // The new code appears as an exact-match cell after the table refetches.
  await expect(page.getByRole('cell', { name: code, exact: true })).toBeVisible({
    timeout: 15_000,
  });
});
