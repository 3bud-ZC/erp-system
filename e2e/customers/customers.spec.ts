/**
 * Customers create-flow.
 *
 * Authenticated via the cached admin storageState produced by global.setup.ts.
 * Uses a time-stamped code so reruns don't collide on the unique-code constraint.
 */

import { test, expect } from '@playwright/test';
import { runId } from '../fixtures/credentials';

test('create a customer and see them in the table', async ({ page }) => {
  const code = `E2E-CUS-${runId()}`;
  const nameAr = `عميل اختبار ${code}`;

  await page.goto('/customers');

  // Wait for either the table or an empty-state to render — both are valid post-load states.
  await page.waitForLoadState('networkidle');

  // Open the "Add customer" modal — button label: "إضافة عميل"
  await page.getByRole('button', { name: /إضافة عميل/ }).first().click();

  // Modal heading appears
  await expect(page.getByRole('heading', { name: /إضافة عميل جديد/ })).toBeVisible();

  // Fill the required fields. Code goes in the first input labelled "الرمز".
  await page.getByLabel(/^الرمز/).fill(code);
  await page.getByLabel(/الاسم بالعربية/).fill(nameAr);

  // Submit — the modal's submit button is "حفظ"
  await page.getByRole('button', { name: /^حفظ$/ }).click();

  // Toast appears + modal closes
  await expect(page.locator('text=تم إضافة العميل بنجاح')).toBeVisible({ timeout: 10_000 });

  // The new code appears in the table
  await expect(page.locator(`text=${code}`)).toBeVisible({ timeout: 5_000 });
});
