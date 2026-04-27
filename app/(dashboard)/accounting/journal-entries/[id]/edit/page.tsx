'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/fetcher';
import { JournalEntryForm, type JournalEntryExisting } from '@/components/accounting/JournalEntryForm';
import { ErrorBanner } from '@/components/ui/patterns';

export default function EditJournalEntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data,    setData]    = useState<JournalEntryExisting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet<JournalEntryExisting[] | { entries: JournalEntryExisting[] }>('/api/journal-entries')
      .then(raw => {
        if (!active) return;
        const list = Array.isArray(raw) ? raw : raw?.entries ?? [];
        const found = list.find(j => j.id === id);
        if (!found) return setError('القيد غير موجود');
        if (found.isPosted || found.status === 'POSTED') {
          return setError('لا يمكن تعديل قيد مرحّل — يمكن عكسه فقط');
        }
        setData(found);
      })
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="p-6 flex items-center justify-center h-64 text-slate-500" dir="rtl">جاري تحميل القيد…</div>;
  if (error)   return <div className="p-6" dir="rtl"><ErrorBanner message={error} onRetry={() => router.refresh()} /></div>;
  if (!data)   return null;

  return <JournalEntryForm mode="edit" existing={data} />;
}
