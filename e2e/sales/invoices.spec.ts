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

test('create a sales invoice (Save & New) and see success toast', async ({ page }) => {
  await page.goto('/sales/invoices/new');

  // Wait for the page's initial data load (customers + products) to finish.
  await expect(page.locator('text=جاري تحميل البيانات')).toHaveCount(0, { timeout: 15_000 });

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

  // Click 'حفظ وجديد' (stays on page) — preferred over 'حفظ وإغلاق' which navigates away.
  await page.getByRole('button', { name: /حفظ وجديد/ }).click();

  // Toast appears
  await expect(page.locator('text=تم حفظ الفاتورة بنجاح')).toBeVisible({ timeout: 15_000 });
});
