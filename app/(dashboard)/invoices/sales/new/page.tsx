'use client';

import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { SALES_CONFIG } from '@/components/invoices/InvoiceConfig';

export default function NewSalesInvoicePage() {
  return <InvoiceForm config={SALES_CONFIG} mode="create" />;
}
