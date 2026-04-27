'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { Plus, ClipboardList, Search, Eye, Trash2 } from 'lucide-react';
import { TableSkeleton, EmptyState, ErrorBanner, Toast, useToast } from '@/components/ui/patterns';
import { ManufacturingLayout } from '@/components/manufacturing/ManufacturingLayout';

interface ProductionOrder {
  id: string;
  orderNumber: string;
  status: string;
  quantity: number;
  produced?: number;
  date: string;
  cost?: number;
  product?: { id?: string; nameAr?: string; code?: string; unit?: string };
  productionLine?: { id?: string; name?: string };
}

const TABLE_COLS = ['w-28', 'w-28', 'w-40', 'w-32', 'w-28', 'w-24', 'w-20'];

const STATUS_OPTS = [
  { k: 'all',         label: 'الكل' },
  { k: 'pending',     label: 'معلّق' },
  { k: 'in_progress', label: 'قيد التنفيذ' },
  { k: 'completed',   label: 'مكتمل' },
  { k: 'cancelled',   label: 'ملغى' },
] as const;

function statusBadge(s: string) {
  const m: Record<string, { label: string; cls: string }> = {
    pending:     { label: 'معلّق',         cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    in_progress: { label: 'قيد التنفيذ',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    completed:   { label: 'مكتمل',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    cancelled:   { label: 'ملغى',           cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  };
  return m[s] ?? m.pending;
}

export default function ProductionOrdersListPage() {
  const qc = useQueryClient();
  const [toast, showToast] = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const ordersQ = useQuery({
    queryKey: ['production-orders'],
    queryFn:  () => apiGet<ProductionOrder[]>('/api/production-orders'),
    staleTime: 30_000,
  });

  const orders  = useMemo(() => ordersQ.data ?? [], [ordersQ.data]);
  const loading = ordersQ.isLoading;
  const error   = ordersQ.error ? (ordersQ.error as Error).message : null;

  const reload = useCallback(
    () => qc.invalidateQueries({ queryKey: ['production-orders'] }),
    [qc],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [o.orderNumber, o.product?.nameAr, o.product?.code, o.productionLine?.name]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [orders, search, statusFilter]);

  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/production-orders?id=${deleteId}`, {
        method: 'DELETE', credentials: 'include',
      });
      const j = await res.json();
      if (j.success) {
        setDeleteId(null);
        reload();
        showToast('تم حذف الأمر', 'success');
      } else {
        setDeleteError(j.message || j.error || 'فشل الحذف');
      }
    } catch { setDeleteError('تعذر الاتصال بالخادم'); }
    finally { setDeleting(false); }
  }

  return (
    <ManufacturingLayout
      title="أوامر الإنتاج"
      subtitle={loading ? 'جاري التحميل…' : `${orders.length} أمر`}
      toolbar={
        <Link
          href="/manufacturing/production-orders/new"
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> أمر إنتاج جديد
        </Link>
      }
    >
      <Toast toast={toast} />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg flex-wrap">
          {STATUS_OPTS.map(o => (
            <button key={o.k} onClick={() => setStatusFilter(o.k)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === o.k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث برقم الأمر أو المنتج…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {error && <div className="mb-5"><ErrorBanner message={error} onRetry={() => ordersQ.refetch()} /></div>}

      {loading ? (
        <TableSkeleton cols={TABLE_COLS} rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={search || statusFilter !== 'all' ? 'لا توجد أوامر مطابقة' : 'لا توجد أوامر إنتاج بعد'}
          description={!search && statusFilter === 'all' ? 'أنشئ أول أمر إنتاج لتبدأ' : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">رقم الأمر</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">المنتج</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">خط الإنتاج</th>
                <th className="px-5 py-3 text-left  text-xs font-semibold text-slate-500">الكمية</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">الحالة</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(o => {
                const s = statusBadge(o.status);
                return (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-slate-700">{o.orderNumber}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {new Date(o.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-800">
                      <div className="font-medium">{o.product?.nameAr ?? '—'}</div>
                      {o.product?.code && (
                        <div className="text-xs text-slate-400 font-mono">{o.product.code}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{o.productionLine?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700 text-left tabular-nums">
                      {(o.produced ?? 0).toLocaleString('ar-EG')} / {o.quantity.toLocaleString('ar-EG')} {o.product?.unit ?? ''}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/manufacturing/production-orders/${o.id}`} title="عرض"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button onClick={() => { setDeleteId(o.id); setDeleteError(null); }}
                          disabled={o.status === 'completed'}
                          title={o.status === 'completed' ? 'لا يمكن حذف أمر مكتمل' : 'حذف'}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
            <h3 className="text-lg font-semibold text-slate-900 mb-2">حذف أمر الإنتاج</h3>
            <p className="text-sm text-slate-500 mb-3">
              هل أنت متأكد من حذف أمر الإنتاج؟ هذا الإجراء لا يمكن التراجع عنه.
            </p>
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
