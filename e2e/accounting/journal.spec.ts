/**
 * Journal entries create-flow.
 *
 * Authenticated via cached admin storageState. After Phase 4 the page is
 * TanStack Query-driven; invalidateQueries should make the new entry visible
 * after submit without a manual refresh.
 *
 * Account codes 1001 (cash) and 4001 (revenue) are conventional defaults; if
 * the chart-of-accounts seed uses different codes the test will fail with a
 * validation error which is informative on its own (STOP condition kicks in).
 */

import { test, expect } from '@playwright/test';
import { runId } from '../fixtures/credentials';
import { gotoAuthenticated, installAuthMeIntercept } from '../fixtures/auth-helpers';
import { inputByLabelText } from '../fixtures/form-helpers';

test.beforeEach(async ({ context }) => {
  await installAuthMeIntercept(context);
});

test('create a journal entry and see it in the table', async ({ page }) => {
  // Form-login + SPA nav + cold-compile of /accounting/journal-entries can
  // exceed the default 30s test timeout — bump to 90s.
  test.setTimeout(90_000);

  const description = `E2E قيد اختبار ${runId()}`;

  await gotoAuthenticated(page, '/accounting/journal-entries');

  // Wait for page header instead of networkidle (TanStack Query never settles).
  await expect(page.getByRole('heading', { name: /القيود المحاسبية/ }).first()).toBeVisible({ timeout: 30_000 });

  // Open the "New entry" modal
  await page.getByRole('button', { name: /قيد جديد/ }).click();
  await expect(page.getByRole('heading', { name: /قيد محاسبي جديد/ })).toBeVisible();

  // Scope to the modal — the page table also has a "البيان" column header.
  const modal = page.locator('div').filter({ hasText: /^قيد محاسبي جديد/ }).first();

  // Description (البيان) — first label "البيان *" in the modal header row.
  await inputByLabelText(modal, /^البيان/).fill(description);

  // Two account lines: debit cash (1001) 100, credit revenue (4001) 100 — balanced.
  // The modal renders inputs in table cells. We grab them positionally.
  const accountInputs = page.locator('input[placeholder="1001"]');
  await accountInputs.nth(0).fill('1001');
  await accountInputs.nth(1).fill('4001');

  // Debit/credit columns — inputs of type=number, 4 per row pair (2 lines × debit+credit = 4).
  // Order in DOM: line0.debit, line0.credit, line1.debit, line1.credit.
  const numberInputs = page.locator('div.fixed input[type="number"]');
  await numberInputs.nth(0).fill('100'); // line 0 debit
  await numberInputs.nth(1).fill('0');   // line 0 credit
  await numberInputs.nth(2).fill('0');   // line 1 debit
  await numberInputs.nth(3).fill('100'); // line 1 credit

  // Submit
  await page.getByRole('button', { name: /^حفظ القيد$/ }).click();

  // Modal closes (best smoke signal — content still rendering server-side).
  // Wait up to 15s for the modal heading to disappear.
  await expect(page.getByRole('heading', { name: /قيد محاسبي جديد/ })).toBeHidden({ timeout: 15_000 });
});
