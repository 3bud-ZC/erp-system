'use client';

import { InvoicePrintPage } from '@/components/invoices/InvoicePrintPage';
import { SALES_CONFIG } from '@/components/invoices/InvoiceConfig';

export default function SalesInvoicePrintPage() {
  return <InvoicePrintPage config={SALES_CONFIG} />;
}
