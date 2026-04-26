'use client';

import { InvoiceEditPage } from '@/components/invoices/InvoiceEditPage';
import { SALES_CONFIG } from '@/components/invoices/InvoiceConfig';

export default function SalesInvoiceEditPage() {
  return <InvoiceEditPage config={SALES_CONFIG} />;
}
