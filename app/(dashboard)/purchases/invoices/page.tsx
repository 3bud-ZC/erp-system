import { redirect } from 'next/navigation';

/**
 * Backward-compat: /purchases/invoices → /invoices/purchases
 */
export default function LegacyPurchaseInvoicesPage() {
  redirect('/invoices/purchases');
}
