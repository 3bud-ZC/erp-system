'use client';

import { InvoiceList } from '@/components/invoices/InvoiceList';
import { PURCHASE_CONFIG } from '@/components/invoices/InvoiceConfig';

export default function PurchaseInvoicesListPage() {
  return <InvoiceList config={PURCHASE_CONFIG} />;
}
