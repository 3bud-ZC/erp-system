/**
 * Inventory products create-flow.
 *
 * Authenticated via cached admin storageState.
 * After Phase 4 the products page reads through TanStack Query; mutation
 * triggers invalidateQueries and the new row should appear without manual reload.
 */

import { test, expect } from '@playwright/test';
import { runId } from '../fixtures/credentials';

test('create a product and see it in the table', async ({ page }) => {
  const code = `E2E-PRD-${runId()}`;
  const nameAr = `منتج اختبار ${code}`;

  await page.goto('/inventory/products');
  await page.waitForLoadState('networkidle');

  // Open the "Add product" modal — button label "إضافة منتج"
  await page.getByRole('button', { name: /إضافة منتج/ }).first().click();
  await expect(page.getByRole('heading', { name: /إضافة منتج جديد/ })).toBeVisible();

  // Fill required fields:  code, nameAr, price.
  await page.getByLabel(/^الرمز/).fill(code);
  await page.getByLabel(/الاسم بالعربية/).fill(nameAr);
  await page.getByLabel(/سعر البيع/).fill('100');

  // Submit
  await page.getByRole('button', { name: /^حفظ$/ }).click();

  // Toast confirms creation
  await expect(page.locator('text=تم إضافة المنتج بنجاح')).toBeVisible({ timeout: 10_000 });

  // Row appears in the table
  await expect(page.locator(`text=${code}`)).toBeVisible({ timeout: 5_000 });
});
