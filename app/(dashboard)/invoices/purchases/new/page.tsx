'use client';

import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { PURCHASE_CONFIG } from '@/components/invoices/InvoiceConfig';

export default function NewPurchaseInvoicePage() {
  return <InvoiceForm config={PURCHASE_CONFIG} mode="create" />;
}
