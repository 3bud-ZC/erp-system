/**
 * Customers create-flow.
 *
 * Authenticated via the cached admin storageState produced by global.setup.ts.
 * Uses a time-stamped code so reruns don't collide on the unique-code constraint.
 */

import { test, expect } from '@playwright/test';
import { runId } from '../fixtures/credentials';
import { gotoAuthenticated, installAuthMeIntercept } from '../fixtures/auth-helpers';
import { inputByLabelText } from '../fixtures/form-helpers';

test.beforeEach(async ({ context }) => {
  await installAuthMeIntercept(context);
});

test('create a customer and see them in the table', async ({ page }) => {
  test.setTimeout(90_000);

  const code = `E2E-CUS-${runId()}`;
  const nameAr = `عميل اختبار ${code}`;

  await gotoAuthenticated(page, '/customers');

  // Don't use waitForLoadState('networkidle') — TanStack Query background
  // refetches keep the network busy indefinitely. Wait for the page header
  // (always rendered) instead, which guarantees React mounted.
  await expect(page.getByRole('heading', { name: /العملاء/ }).first()).toBeVisible({ timeout: 30_000 });

  // Open the "Add customer" modal — button label: "إضافة عميل"
  await page.getByRole('button', { name: /إضافة عميل/ }).first().click();

  // Modal heading appears
  await expect(page.getByRole('heading', { name: /إضافة عميل جديد/ })).toBeVisible();

  // Scope to the modal so we don't accidentally pick up the page-level search input.
  const modal = page.locator('div').filter({ hasText: /^إضافة عميل جديد/ }).first();

  // The InputField component doesn't link <label htmlFor> ↔ <input id>, so
  // getByLabel() returns nothing. inputByLabelText walks DOM siblings.
  await inputByLabelText(modal, /^الرمز/).fill(code);
  await inputByLabelText(modal, /الاسم بالعربية/).fill(nameAr);

  // Set up the API response listener BEFORE the click — toast auto-hides
  // after 3s and races on slow-DB runs. Waiting on the POST gives a
  // deterministic signal that the customer was created.
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/api/customers') && r.request().method() === 'POST',
    { timeout: 30_000 }
  );

  // Submit — the modal's submit button is "حفظ"
  await page.getByRole('button', { name: /^حفظ$/ }).click();

  const resp = await respPromise;
  expect(resp.status(), 'customers API should accept the request').toBeLessThan(400);

  // The new code appears in the table after `load()` refetches. Use the
  // role=cell locator scoped to an exact-match name — the nameAr column also
  // contains the code as a substring ("عميل اختبار E2E-CUS-..."), which
  // would otherwise produce a strict-mode violation.
  await expect(page.getByRole('cell', { name: code, exact: true })).toBeVisible({
    timeout: 15_000,
  });
});
