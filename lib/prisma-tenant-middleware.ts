/**
 * NEUTRALIZED — kept only for backward compatibility with existing imports.
 *
 * The previous implementation registered a Prisma middleware that injected
 * `tenantId` into every query for non-system models. This was broken because
 * many child tables (SalesInvoiceItem, PurchaseInvoiceItem, JournalEntryLine,
 * BOMItem, etc.) don't have a `tenantId` field — Prisma rejected those queries
 * with "Unknown argument tenantId". It also relied on a process-global mutable
 * variable, which is a cross-tenant leak under concurrent requests.
 *
 * Tenant scoping is now done explicitly per-route, e.g.:
 *   await prisma.salesInvoice.findFirst({
 *     where: { id, tenantId: user.tenantId },
 *   });
 *
 * The exports below are kept as no-ops so existing imports
 * (`lib/auth.ts`, `lib/auth/requireAuth.ts`) keep type-checking and don't
 * accidentally re-introduce the bug. They MUST stay no-ops.
 */

import type { Prisma } from '@prisma/client';

export function setTenantContext(_tenantId: string | null): void {
  // intentionally no-op
}

export function getTenantContext(): string | null {
  return null;
}

export function clearTenantContext(): void {
  // intentionally no-op
}

/**
 * No-op middleware. Kept only so any code path that used to register it
 * (e.g. in tests or scripts) still compiles. It now passes the params through
 * untouched.
 */
export const tenantMiddleware: Prisma.Middleware = async (params, next) => {
  return next(params);
};
