'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/fetcher';
import { ProductForm, type ProductExisting } from '@/components/products/ProductForm';
import { ErrorBanner } from '@/components/ui/patterns';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data,    setData]    = useState<ProductExisting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<ProductExisting[]>('/api/products')
      .then(list => {
        if (!active) return;
        const found = list.find(p => p.id === id);
        if (found) setData(found);
        else setError('المنتج غير موجود');
      })
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="p-6 flex items-center justify-center h-64 text-slate-500" dir="rtl">جاري تحميل بيانات المنتج…</div>;
  if (error)   return <div className="p-6" dir="rtl"><ErrorBanner message={error} onRetry={() => router.refresh()} /></div>;
  if (!data)   return null;

  return <ProductForm mode="edit" existing={data} />;
}
