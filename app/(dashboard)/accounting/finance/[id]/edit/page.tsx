'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/fetcher';
import { ExpenseForm, type ExpenseExisting } from '@/components/accounting/ExpenseForm';
import { ErrorBanner } from '@/components/ui/patterns';

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data,    setData]    = useState<ExpenseExisting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<ExpenseExisting[]>('/api/expenses')
      .then(list => {
        if (!active) return;
        const found = list.find(x => x.id === id);
        if (found) setData(found);
        else setError('المصروف غير موجود');
      })
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="p-6 flex items-center justify-center h-64 text-slate-500" dir="rtl">جاري تحميل بيانات المصروف…</div>;
  if (error)   return <div className="p-6" dir="rtl"><ErrorBanner message={error} onRetry={() => router.refresh()} /></div>;
  if (!data)   return null;

  return <ExpenseForm mode="edit" existing={data} />;
}
