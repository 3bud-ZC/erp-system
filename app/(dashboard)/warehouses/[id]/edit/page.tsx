'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/fetcher';
import { WarehouseForm, type WarehouseExisting } from '@/components/warehouses/WarehouseForm';
import { ErrorBanner } from '@/components/ui/patterns';

export default function EditWarehousePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data,    setData]    = useState<WarehouseExisting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<WarehouseExisting[]>('/api/warehouses')
      .then(list => {
        if (!active) return;
        const found = list.find(w => w.id === id);
        if (found) setData(found);
        else setError('المستودع غير موجود');
      })
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="p-6 flex items-center justify-center h-64 text-slate-500" dir="rtl">جاري تحميل بيانات المستودع…</div>;
  if (error)   return <div className="p-6" dir="rtl"><ErrorBanner message={error} onRetry={() => router.refresh()} /></div>;
  if (!data)   return null;

  return <WarehouseForm mode="edit" existing={data} />;
}
