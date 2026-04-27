'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/fetcher';
import { CustomerForm, type CustomerExisting } from '@/components/customers/CustomerForm';
import { ErrorBanner } from '@/components/ui/patterns';

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data,    setData]    = useState<CustomerExisting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<CustomerExisting[]>('/api/customers')
      .then(list => {
        if (!active) return;
        const found = list.find(c => c.id === id);
        if (found) setData(found);
        else setError('العميل غير موجود');
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-slate-500" dir="rtl">
        جاري تحميل بيانات العميل…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6" dir="rtl">
        <ErrorBanner message={error} onRetry={() => router.refresh()} />
      </div>
    );
  }
  if (!data) return null;

  return <CustomerForm mode="edit" existing={data} />;
}
