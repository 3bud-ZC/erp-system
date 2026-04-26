'use client';

import { InvoiceDetail } from '@/components/invoices/InvoiceDetail';
import { SALES_CONFIG } from '@/components/invoices/InvoiceConfig';

export default function SalesInvoiceDetailPage() {
  return <InvoiceDetail config={SALES_CONFIG} />;
}
