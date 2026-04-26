'use client';

import { InvoiceList } from '@/components/invoices/InvoiceList';
import { SALES_CONFIG } from '@/components/invoices/InvoiceConfig';

export default function SalesInvoicesListPage() {
  return <InvoiceList config={SALES_CONFIG} />;
}
