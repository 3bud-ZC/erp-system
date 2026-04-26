/**
 * Invoice number auto-generation.
 *
 * Generates a sequential per-tenant, per-year invoice number with a configurable
 * prefix. Format: `{PREFIX}-{YYYY}-{NNNNNN}` (zero-padded to 6 digits).
 *
 * If the caller provided a non-empty number, it is returned unchanged so users
 * who type their own invoice numbers manually still control the value.
 */

import { prisma } from './db';

export type InvoicePrefix = 'INV' | 'PI';

/**
 * Resolve the invoice number to use.
 *
 * @param providedNumber  Whatever the client sent (may be undefined / empty).
 * @param prefix          'INV' for sales, 'PI' for purchase.
 * @param tenantId        Tenant scope (numbers are sequential per tenant).
 * @param year            Optional year (defaults to current).
 */
export async function resolveInvoiceNumber(
  providedNumber: string | null | undefined,
  prefix: InvoicePrefix,
  tenantId: string,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const trimmed = (providedNumber ?? '').trim();
  if (trimmed.length > 0) return trimmed;

  const yearStr = String(year);
  const search = `${prefix}-${yearStr}-`;

  // Find the highest existing number for this tenant + year + prefix.
  const last = prefix === 'PI'
    ? await prisma.purchaseInvoice.findFirst({
        where: {
          tenantId,
          invoiceNumber: { startsWith: search },
        },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      })
    : await prisma.salesInvoice.findFirst({
        where: {
          tenantId,
          invoiceNumber: { startsWith: search },
        },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
      });

  let nextSeq = 1;
  if (last?.invoiceNumber) {
    const parts = last.invoiceNumber.split('-');
    // Expect [PREFIX, YEAR, NNNNNN]; defensively handle malformed values.
    const tail = parts[parts.length - 1];
    const parsed = parseInt(tail, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      nextSeq = parsed + 1;
    }
  }

  return `${prefix}-${yearStr}-${String(nextSeq).padStart(6, '0')}`;
}
