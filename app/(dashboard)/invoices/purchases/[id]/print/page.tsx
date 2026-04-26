'use client';

import { InvoicePrintPage } from '@/components/invoices/InvoicePrintPage';
import { PURCHASE_CONFIG } from '@/components/invoices/InvoiceConfig';

export default function PurchaseInvoicePrintPage() {
  return <InvoicePrintPage config={PURCHASE_CONFIG} />;
}
