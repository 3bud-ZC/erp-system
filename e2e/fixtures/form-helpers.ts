/**
 * Form locators for unlinked label/input pairs.
 *
 * The app's `InputField` component (and ad-hoc forms in customers, products,
 * journal-entries, etc.) renders:
 *
 *   <div>
 *     <label>الرمز *</label>
 *     <input ... />
 *   </div>
 *
 * Note the absence of `for=` / `id=` linkage. Playwright's `getByLabel()`
 * relies on programmatic association (for/id, aria-labelledby, or input-
 * inside-label) and therefore returns nothing for these inputs.
 *
 * `inputByLabelText` finds the first label whose visible text contains the
 * given substring/regex, then walks to the next input sibling — which IS the
 * field that label visually annotates given the conventional InputField markup.
 */

import type { Locator, Page } from '@playwright/test';

export function inputByLabelText(
  scope: Page | Locator,
  text: string | RegExp
): Locator {
  // Match the label by its visible text. .filter({ hasText }) accepts both
  // string (substring) and RegExp.
  const label = scope.locator('label').filter({ hasText: text }).first();
  // Walk to the immediately-following sibling that is an <input>.
  // Using XPath because CSS '+' would require a single combined selector and
  // we want to chain off the already-resolved label locator.
  return label.locator('xpath=following-sibling::input[1]');
}

/** Same idea, but for a `<select>` or `<textarea>` after the label. */
export function controlByLabelText(
  scope: Page | Locator,
  text: string | RegExp,
  tag: 'select' | 'textarea' | 'input' = 'input'
): Locator {
  const label = scope.locator('label').filter({ hasText: text }).first();
  return label.locator(`xpath=following-sibling::${tag}[1]`);
}
