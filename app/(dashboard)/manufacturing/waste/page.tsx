'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { Plus, AlertTriangle, Trash2, Search } from 'lucide-react';
import { TableSkeleton, EmptyState, ErrorBanner, Toast, useToast } from '@/components/ui/patterns';
import { ManufacturingLayout } from '@/components/manufacturing/ManufacturingLayout';

interface WasteEntry {
  id:                string;
  quantity:          number;
  date:              string;
  notes?:            string | null;
  productId:         string;
  productionOrderId?: string | null;
  product?:          { nameAr?: string; code?: string; unit?: string };
  productionOrder?:  { orderNumber?: string };
}

const TABLE_COLS = ['w-28', 'w-40', 'w-28', 'w-32', 'w-40', 'w-20'];

export default function WasteListPage() {
  const qc = useQueryClient();
  const [toast, showToast] = useToast();
  const [search, setSearch] = useState('');

  const wasteQ = useQuery({
    queryKey: ['production-waste'],
    queryFn:  () => apiGet<WasteEntry[]>('/api/production-waste'),
    staleTime: 30_000,
  });
  const wastes = useMemo(() => wasteQ.data ?? [], [wasteQ.data]);
  const loading = wasteQ.isLoading;
  const error   = wasteQ.error ? (wasteQ.error as Error).message : null;

  const reload = useCallback(
    () => qc.invalidateQueries({ queryKey: ['production-waste'] }),
    [qc],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return wastes;
    return wastes.filter(w => {
      const hay = [w.product?.nameAr, w.product?.code, w.productionOrder?.orderNumber, w.notes]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [wastes, search]);

  const totalQty = useMemo(
    () => wastes.reduce((s, w) => s + (Number(w.quantity) || 0), 0),
    [wastes],
  );

  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/production-waste?id=${deleteId}`, {
        method: 'DELETE', credentials: 'include',
      });
      const j = await res.json();
      if (j.success) {
        setDeleteId(null);
        reload();
        showToast('تم حذف السجل وعكس تأثير المخزون', 'success');
      } else {
        setDeleteError(j.message || j.error || 'فشل الحذف');
      }
    } catch { setDeleteError('تعذر الاتصال بالخادم'); }
    finally { setDeleting(false); }
  }

  return (
    <ManufacturingLayout
      title="سجل الفاقد"
      subtitle={loading ? 'جاري التحميل…' : `${wastes.length} سجل · إجمالي الكمية ${totalQty.toLocaleString('ar-EG')}`}
      toolbar={
        <Link href="/manufacturing/waste/new"
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium">
          <Plus className="w-4 h-4" /> تسجيل فاقد
        </Link>
      }
    >
      <Toast toast={toast} />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-48 max-w-md">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالمنتج أو رقم الأمر…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {error && <div className="mb-5"><ErrorBanner message={error} onRetry={() => wasteQ.refetch()} /></div>}

      {loading ? (
        <TableSkeleton cols={TABLE_COLS} rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={AlertTriangle}
          title={search ? 'لا توجد سجلات مطابقة' : 'لا توجد سجلات فاقد بعد'}
          description={!search ? 'استخدم زر "تسجيل فاقد" لإضافة أول سجل' : undefined} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">المنتج</th>
                <th className="px-5 py-3 text-left  text-xs font-semibold text-slate-500">الكمية</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">أمر الإنتاج</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">ملاحظات</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(w => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-sm text-slate-500">
                    {new Date(w.date).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-800">
                    <div className="font-medium">{w.product?.nameAr ?? '—'}</div>
                    {w.product?.code && (
                      <div className="text-xs text-slate-400 font-mono">{w.product.code}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-red-600 text-left tabular-nums">
                    -{w.quantity.toLocaleString('ar-EG')} {w.product?.unit ?? ''}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500 font-mono">
                    {w.productionOrder?.orderNumber ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600 max-w-xs truncate">{w.notes ?? '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => { setDeleteId(w.id); setDeleteError(null); }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">حذف سجل الفاقد</h3>
            <p className="text-sm text-slate-500 mb-3">سيتم إعادة الكمية للمخزون وحذف السجل.</p>
            {deleteError && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-2 rounded mb-3">{deleteError}</div>
            )}
            <div className="flex gap-3">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? 'جاري الحذف…' : 'حذف'}
              </button>
              <button onClick={() => setDeleteId(null)}
                className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </ManufacturingLayout>
  );
}
