'use client';

import { useRouter } from 'next/navigation';
import { InvoiceForm } from '@/components/sales/InvoiceForm';

export default function NewInvoicePage() {
  const router = useRouter();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Create Sales Invoice</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <InvoiceForm
          onSuccess={() => router.push('/sales/invoices')}
          onCancel={() => router.back()}
        />
      </div>
    </div>
  );
}
