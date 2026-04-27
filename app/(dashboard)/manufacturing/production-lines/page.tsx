'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { Plus, Pencil, Trash2, GitBranch, CheckCircle, XCircle } from 'lucide-react';
import { CardGridSkeleton, EmptyState, ErrorBanner, Toast, useToast } from '@/components/ui/patterns';
import { ManufacturingLayout } from '@/components/manufacturing/ManufacturingLayout';

interface ProductionLine {
  id:              string;
  code:            string;
  name:            string;
  capacityPerHour: number;
  description?:    string | null;
  status:          string;
  assignments?:    { id: string; product?: { nameAr?: string; code?: string } }[];
  productionOrders?: any[];
}

export default function ProductionLinesPage() {
  const qc = useQueryClient();
  const [toast, showToast] = useToast();

  const linesQ = useQuery({
    queryKey: ['production-lines'],
    queryFn:  () => apiGet<ProductionLine[]>('/api/production-lines'),
    staleTime: 60_000,
  });
  const lines = useMemo(() => linesQ.data ?? [], [linesQ.data]);
  const loading = linesQ.isLoading;
  const error   = linesQ.error ? (linesQ.error as Error).message : null;

  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/production-lines?id=${deleteId}`, {
        method: 'DELETE', credentials: 'include',
      });
      const j = await res.json();
      if (j.success) {
        setDeleteId(null);
        qc.invalidateQueries({ queryKey: ['production-lines'] });
        showToast('تم حذف خط الإنتاج', 'success');
      } else {
        setDeleteError(j.message || j.error || 'فشل الحذف');
      }
    } catch { setDeleteError('تعذر الاتصال بالخادم'); }
    finally { setDeleting(false); }
  }

  return (
    <ManufacturingLayout
      title="خطوط الإنتاج"
      subtitle={loading ? 'جاري التحميل…' : `${lines.length} خط`}
      toolbar={
        <Link href="/manufacturing/production-lines/new"
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium">
          <Plus className="w-4 h-4" /> خط جديد
        </Link>
      }
    >
      <Toast toast={toast} />

      {error && <div className="mb-5"><ErrorBanner message={error} onRetry={() => linesQ.refetch()} /></div>}

      {loading ? (
        <CardGridSkeleton cols={2} count={4} />
      ) : lines.length === 0 ? (
        <EmptyState icon={GitBranch} title="لا توجد خطوط إنتاج بعد"
          description="أنشئ خط إنتاج لتنظيم أوامر التصنيع وتعيين المنتجات لها" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lines.map(l => (
            <div key={l.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-purple-500" />
                    {l.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{l.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  {l.status === 'active' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                      <CheckCircle className="w-3 h-3" /> نشط
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
                      <XCircle className="w-3 h-3" /> غير نشط
                    </span>
                  )}
                  <Link href={`/manufacturing/production-lines/${l.id}/edit`}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button onClick={() => { setDeleteId(l.id); setDeleteError(null); }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-slate-500">
                <div><span className="text-slate-400">الطاقة الإنتاجية: </span>
                  <span className="font-semibold text-slate-700 tabular-nums">{l.capacityPerHour.toLocaleString('ar-EG')}</span> وحدة/ساعة
                </div>
                {l.description && <div><span className="text-slate-400">الوصف: </span>{l.description}</div>}
                {l.assignments && l.assignments.length > 0 && (
                  <div>
                    <span className="text-slate-400">منتجات معيّنة: </span>
                    {l.assignments.length} منتج
                  </div>
                )}
                {l.productionOrders && l.productionOrders.length > 0 && (
                  <div className="text-blue-600">
                    {l.productionOrders.length} أمر نشط الآن
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">حذف خط الإنتاج</h3>
            <p className="text-sm text-slate-500 mb-3">سيتم حذف الخط وكل تعييناته للمنتجات.</p>
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
