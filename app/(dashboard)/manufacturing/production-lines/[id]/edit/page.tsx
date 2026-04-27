'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/fetcher';
import { ProductionLineForm, type ProductionLineExisting } from '@/components/manufacturing/ProductionLineForm';
import { ErrorBanner } from '@/components/ui/patterns';

export default function EditProductionLinePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data,    setData]    = useState<ProductionLineExisting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<ProductionLineExisting>(`/api/production-lines?id=${id}`)
      .then(found => {
        if (!active) return;
        if (found && (found as any).id) setData(found);
        else setError('خط الإنتاج غير موجود');
      })
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="p-6 flex items-center justify-center h-64 text-slate-500" dir="rtl">جاري تحميل بيانات الخط…</div>;
  if (error)   return <div className="p-6" dir="rtl"><ErrorBanner message={error} onRetry={() => router.refresh()} /></div>;
  if (!data)   return null;

  return <ProductionLineForm mode="edit" existing={data} />;
}
