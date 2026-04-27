'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import Link from 'next/link';
import {
  Plus, CheckCircle, Clock, Trash2, BookOpen, RefreshCw, Pencil, RotateCcw, Send,
} from 'lucide-react';
import { TableSkeleton, EmptyState, ErrorBanner } from '@/components/ui/patterns';
import { AccountingLayout } from '@/components/accounting/AccountingLayout';

interface JournalEntry {
  id: string;
  entryNumber?: string;
  date?: string;
  entryDate?: string;
  createdAt: string;
  description?: string;
  totalDebit?: number;
  totalCredit?: number;
  isPosted?: boolean;
  status?: 'DRAFT' | 'POSTED';
  reversalEntryId?: string | null;
}

function fmtEGP(v?: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG');
}

function isPostedEntry(e: JournalEntry): boolean {
  if (typeof e.isPosted === 'boolean') return e.isPosted;
  return e.status === 'POSTED';
}

const TABLE_COLS = ['w-24', 'w-24', 'w-48', 'w-28', 'w-28', 'w-16', 'w-32'];

export default function JournalEntriesPage() {
  const qc = useQueryClient();

  const entriesQ = useQuery({
    queryKey: queryKeys.journalEntries,
    queryFn: () => apiGet<JournalEntry[] | { entries: JournalEntry[] }>('/api/journal-entries'),
    staleTime: 1000 * 30,
  });
  const entries = useMemo<JournalEntry[]>(() => {
    const raw = entriesQ.data;
    if (Array.isArray(raw)) return raw;
    return raw?.entries ?? [];
  }, [entriesQ.data]);
  const loading = entriesQ.isLoading;
  const error   = entriesQ.error ? (entriesQ.error as Error).message : null;

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.journalEntries });
  }, [qc]);

  const [confirmDelete,  setConfirmDelete]  = useState<JournalEntry | null>(null);
  const [confirmReverse, setConfirmReverse] = useState<JournalEntry | null>(null);
  const [reverseReason,  setReverseReason]  = useState('');
  const [actionRunning,  setActionRunning]  = useState(false);
  const [actionError,    setActionError]    = useState<string | null>(null);

  async function handleDelete() {
    if (!confirmDelete) return;
    setActionRunning(true); setActionError(null);
    try {
      const res = await fetch(`/api/journal-entries?id=${encodeURIComponent(confirmDelete.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const j = await res.json();
      if (j.success) { setConfirmDelete(null); reload(); }
      else setActionError(j.message || j.error || 'فشل الحذف');
    } catch { setActionError('تعذر الاتصال بالخادم'); }
    finally { setActionRunning(false); }
  }

  async function handlePost(e: JournalEntry) {
    setActionRunning(true);
    try {
      const res = await fetch(`/api/journal-entries/${encodeURIComponent(e.id)}/post`, {
        method: 'POST',
        credentials: 'include',
      });
      const j = await res.json();
      if (j.success) reload();
    } finally {
      setActionRunning(false);
    }
  }

  async function handleReverse() {
    if (!confirmReverse) return;
    setActionRunning(true); setActionError(null);
    try {
      const res = await fetch(`/api/journal-entries/${encodeURIComponent(confirmReverse.id)}/reverse`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reverseReason || 'Manual reversal' }),
      });
      const j = await res.json();
      if (j.success) {
        setConfirmReverse(null);
        setReverseReason('');
        reload();
      } else {
        setActionError(j.message || j.error || 'فشل عكس القيد');
      }
    } catch { setActionError('تعذر الاتصال بالخادم'); }
    finally { setActionRunning(false); }
  }

  return (
    <AccountingLayout
      title="القيود المحاسبية"
      subtitle={loading ? 'جاري التحميل…' : `${entries.length} قيد`}
      toolbar={
        <>
          <button onClick={() => entriesQ.refetch()} disabled={loading || entriesQ.isFetching}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm text-slate-700">
            <RefreshCw className={`w-4 h-4 ${entriesQ.isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <Link href="/accounting/journal-entries/new"
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" /> قيد جديد
          </Link>
        </>
      }
    >
      {error && <ErrorBanner message={error} onRetry={() => entriesQ.refetch()} />}

      {loading ? (
        <TableSkeleton cols={TABLE_COLS} rows={6} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="لا توجد قيود محاسبية حتى الآن"
          description="تُنشأ القيود تلقائياً من الفواتير، أو يمكنك إنشاء قيد يدوي"
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">رقم القيد</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">البيان</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">إجمالي المدين</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">إجمالي الدائن</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">الحالة</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(e => {
                const posted = isPostedEntry(e);
                const reversed = !!e.reversalEntryId;
                return (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700 font-mono">
                      {e.entryNumber ?? e.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{fmtDate(e.entryDate ?? e.date ?? e.createdAt)}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 max-w-xs truncate">{e.description ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-left tabular-nums">{fmtEGP(e.totalDebit)}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-left tabular-nums">{fmtEGP(e.totalCredit)}</td>
                    <td className="px-5 py-3 text-center">
                      {reversed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                          <RotateCcw className="w-3 h-3" /> معكوس
                        </span>
                      ) : posted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                          <CheckCircle className="w-3 h-3" /> مرحّل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-medium">
                          <Clock className="w-3 h-3" /> مسودة
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {!posted && (
                          <>
                            <Link href={`/accounting/journal-entries/${e.id}/edit`} title="تعديل"
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <button onClick={() => handlePost(e)} disabled={actionRunning} title="ترحيل"
                              className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50">
                              <Send className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setConfirmDelete(e); setActionError(null); }} title="حذف"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {posted && !reversed && (
                          <button onClick={() => { setConfirmReverse(e); setActionError(null); setReverseReason(''); }} title="عكس القيد"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">حذف القيد المحاسبي</h3>
            <p className="text-sm text-slate-600 mb-4">
              هل أنت متأكد من حذف القيد <strong className="font-mono">{confirmDelete.entryNumber ?? confirmDelete.id.slice(-6).toUpperCase()}</strong>؟
              لا يمكن التراجع عن هذا الإجراء. (المسودات فقط — القيود المرحّلة تُعكس ولا تُحذف.)
            </p>
            {actionError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-2 rounded mb-3">{actionError}</div>}
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={actionRunning}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {actionRunning ? 'جاري الحذف…' : 'نعم، احذف'}
              </button>
              <button onClick={() => { setConfirmDelete(null); setActionError(null); }} disabled={actionRunning}
                className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm reverse modal */}
      {confirmReverse && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">عكس القيد المرحّل</h3>
            <p className="text-sm text-slate-600 mb-3">
              سيتم إنشاء قيد عكسي للقيد <strong className="font-mono">{confirmReverse.entryNumber ?? confirmReverse.id.slice(-6).toUpperCase()}</strong>
              وترحيله تلقائياً، مع الحفاظ على القيد الأصلي للسجلات.
            </p>
            <label className="block text-xs font-medium text-slate-700 mb-1">سبب العكس (اختياري)</label>
            <input value={reverseReason} onChange={e => setReverseReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="مثال: تصحيح خطأ في المبلغ" />
            {actionError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-2 rounded mb-3">{actionError}</div>}
            <div className="flex gap-3">
              <button onClick={handleReverse} disabled={actionRunning}
                className="flex-1 bg-amber-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                {actionRunning ? 'جاري العكس…' : 'تأكيد العكس'}
              </button>
              <button onClick={() => { setConfirmReverse(null); setReverseReason(''); setActionError(null); }} disabled={actionRunning}
                className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </AccountingLayout>
  );
}
