'use client';

import { InvoiceEditPage } from '@/components/invoices/InvoiceEditPage';
import { PURCHASE_CONFIG } from '@/components/invoices/InvoiceConfig';

export default function PurchaseInvoiceEditPage() {
  return <InvoiceEditPage config={PURCHASE_CONFIG} />;
}
