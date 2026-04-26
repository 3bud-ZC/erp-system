'use client';

import { InvoiceDetail } from '@/components/invoices/InvoiceDetail';
import { PURCHASE_CONFIG } from '@/components/invoices/InvoiceConfig';

export default function PurchaseInvoiceDetailPage() {
  return <InvoiceDetail config={PURCHASE_CONFIG} />;
}
