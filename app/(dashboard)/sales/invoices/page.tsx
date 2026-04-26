import { redirect } from 'next/navigation';

/**
 * Backward-compat: /sales/invoices → /invoices/sales
 *
 * The unified invoices section was moved under /invoices/* so the
 * sidebar can group both invoice types in one collapsible menu.
 */
export default function LegacySalesInvoicesPage() {
  redirect('/invoices/sales');
}
