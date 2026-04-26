'use client';

/**
 * Generic edit-page client used by both
 * /invoices/sales/[id]/edit and /invoices/purchases/[id]/edit.
 *
 * Loads the existing invoice through the same detail API, then mounts
 * `InvoiceForm` in 'edit' mode with the loaded record pre-populated.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { InvoiceForm } from './InvoiceForm';
import { InvoiceLayout } from './InvoiceLayout';
import { InvoiceConfig } from './InvoiceConfig';

export function InvoiceEditPage({ config }: { config: InvoiceConfig }) {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(config.detailApi(id), { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (cancelled) return;
        if (j.success) setData(j.data);
        else setError(j.message || j.error || 'تعذر تحميل الفاتورة');
      })
      .catch(() => { if (!cancelled) setError('تعذر الاتصال بالخادم'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, config]);

  if (loading) {
    return (
      <InvoiceLayout title="جاري التحميل…">
        <div className="flex items-center justify-center h-64 text-slate-500">جاري تحميل الفاتورة…</div>
      </InvoiceLayout>
    );
  }
  if (error || !data) {
    return (
      <InvoiceLayout title="خطأ">
        <p className="text-red-600">{error ?? 'الفاتورة غير موجودة'}</p>
      </InvoiceLayout>
    );
  }

  // The cast is safe because the InvoiceForm shape matches the API response;
  // any drift will surface as a runtime warning during dev rather than a
  // compile-time error.
  return <InvoiceForm config={config} mode="edit" existing={data as Parameters<typeof InvoiceForm>[0]['existing']} />;
}
