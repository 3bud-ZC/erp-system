'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import {
  Plus, ClipboardList, Search, Trash2, AlertCircle, ArrowUpCircle, ArrowDownCircle, Package,
} from 'lucide-react';
import { TableSkeleton, EmptyState, ErrorBanner, Toast, useToast } from '@/components/ui/patterns';
import { InventoryLayout } from '@/components/inventory/InventoryLayout';
import {
  Modal, Field, SelectField, TextAreaField, PrimaryButton, SecondaryButton,
  FormError, Section, FieldGrid,
} from '@/components/ui/modal';

/* ─── Types ───────────────────────────────────────────────── */
interface ProductLite {
  id:     string;
  code:   string;
  nameAr: string;
  nameEn?: string;
  stock:  number;
  unit?:  string;
}

interface StockAdjustment {
  id:               string;
  adjustmentNumber: string;
  productId:        string;
  type:             'increase' | 'decrease';
  quantity:         number;
  reason:           string;
  notes?:           string | null;
  status:           string;
  date:             string;
  product?: { nameAr?: string; code?: string; unit?: string };
}

const REASON_OPTIONS = [
  { value: 'damaged',     label: 'تالف' },
  { value: 'lost',        label: 'فاقد' },
  { value: 'expired',     label: 'منتهي الصلاحية' },
  { value: 'count_diff',  label: 'فارق جرد' },
  { value: 'received',    label: 'استلام بدون فاتورة' },
  { value: 'returned',    label: 'مردود داخلي' },
  { value: 'other',       label: 'أخرى' },
];

const reasonLabel = (v: string) => REASON_OPTIONS.find(r => r.value === v)?.label ?? v;

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'قيد الاعتماد', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'معتمدة',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'مرفوضة',        cls: 'bg-red-50 text-red-700 border-red-200' },
};

const TABLE_COLS = ['w-28', 'w-28', 'w-32', 'w-24', 'w-20', 'w-24', 'w-28', 'w-20'];

const emptyForm = {
  productId: '',
  type:      'decrease' as 'increase' | 'decrease',
  quantity:  '',
  reason:    'damaged',
  date:      new Date().toISOString().slice(0, 10),
  notes:     '',
};

/* ─── Page ────────────────────────────────────────────────── */
export default function StockAdjustmentsPage() {
  const qc = useQueryClient();
  const [toast, showToast] = useToast();

  /* ── Data ── */
  const adjQ = useQuery({
    queryKey: ['stock-adjustments'],
    queryFn:  () => apiGet<{ stockAdjustments: StockAdjustment[] }>('/api/stock-adjustments'),
    staleTime: 30_000,
  });
  const productsQ = useQuery({
    queryKey: ['products', 'lite'],
    queryFn:  () => apiGet<ProductLite[]>('/api/products'),
    staleTime: 60_000,
  });

  const adjustments = useMemo(
    () => adjQ.data?.stockAdjustments ?? [],
    [adjQ.data],
  );
  const products = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const productMap = useMemo(
    () => new Map(products.map(p => [p.id, p] as const)),
    [products],
  );

  const loading = adjQ.isLoading || productsQ.isLoading;
  const error   = adjQ.error ? (adjQ.error as Error).message : null;

  /* ── Filters ── */
  const [search, setSearch]   = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'increase' | 'decrease'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return adjustments.filter(a => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (!q) return true;
      const p = productMap.get(a.productId);
      const hay = [a.adjustmentNumber, p?.nameAr, p?.code, reasonLabel(a.reason)]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [adjustments, productMap, search, typeFilter]);

  /* ── Add modal ── */
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm]           = useState(emptyForm);

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
    qc.invalidateQueries({ queryKey: ['products'] });
  }, [qc]);

  function openAdd() {
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.productId)              return setFormError('يجب اختيار المنتج');
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0)             return setFormError('الكمية يجب أن تكون أكبر من صفر');
    if (!form.reason)                 return setFormError('يجب اختيار السبب');

    setSaving(true);
    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          type:      form.type,
          quantity:  qty,
          reason:    form.reason,
          date:      form.date,
          notes:     form.notes.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (j.success) {
        setShowModal(false);
        reload();
        showToast('تم تسجيل التسوية', 'success');
      } else {
        setFormError(j.message || j.error || 'فشل الحفظ');
      }
    } catch {
      setFormError('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete confirm ── */
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/stock-adjustments?id=${deleteId}`, {
        method: 'DELETE', credentials: 'include',
      });
      const j = await res.json();
      if (j.success) {
        setDeleteId(null);
        reload();
        showToast('تم حذف التسوية', 'success');
      } else {
        setDeleteError(j.message || j.error || 'فشل الحذف');
      }
    } catch {
      setDeleteError('تعذر الاتصال بالخادم');
    } finally {
      setDeleting(false);
    }
  }

  /* ── Selected product info (for hint inside form) ── */
  const selectedProduct = form.productId ? productMap.get(form.productId) : undefined;

  /* ── Render ── */
  return (
    <InventoryLayout
      title="تسوية المخزون"
      subtitle={loading ? 'جاري التحميل…' : `${adjustments.length} تسوية`}
      toolbar={
        <button onClick={openAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium">
          <Plus className="w-4 h-4" /> تسوية جديدة
        </button>
      }
    >
      <Toast toast={toast} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {([
            { k: 'all',      label: 'الكل' },
            { k: 'increase', label: 'إضافة للمخزون' },
            { k: 'decrease', label: 'خصم من المخزون' },
          ] as const).map(t => (
            <button key={t.k} onClick={() => setTypeFilter(t.k)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                typeFilter === t.k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث برقم التسوية أو المنتج…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {error && <div className="mb-5"><ErrorBanner message={error} onRetry={() => adjQ.refetch()} /></div>}

      {loading ? (
        <TableSkeleton cols={TABLE_COLS} rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={search || typeFilter !== 'all' ? 'لا توجد تسويات مطابقة' : 'لا توجد تسويات بعد'}
          description={!search && typeFilter === 'all' ? 'سجّل تسوية لتعديل أرصدة المخزون (تالف، فاقد، فارق جرد…) ' : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">رقم التسوية</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">المنتج</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">النوع</th>
                <th className="px-5 py-3 text-left  text-xs font-semibold text-slate-500">الكمية</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">السبب</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">الحالة</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(a => {
                const p = productMap.get(a.productId);
                const status = STATUS_LABELS[a.status] ?? STATUS_LABELS.pending;
                const isInc  = a.type === 'increase';
                return (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-slate-700">{a.adjustmentNumber}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {new Date(a.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-800">
                      <div className="font-medium">{a.product?.nameAr || p?.nameAr || '—'}</div>
                      {(a.product?.code || p?.code) && (
                        <div className="text-xs text-slate-400 font-mono">{a.product?.code || p?.code}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        isInc ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {isInc ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                        {isInc ? 'إضافة' : 'خصم'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700 text-left tabular-nums">
                      {isInc ? '+' : '-'}{a.quantity.toLocaleString('ar-EG')} {a.product?.unit || p?.unit || ''}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">{reasonLabel(a.reason)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status.cls}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => { setDeleteId(a.id); setDeleteError(null); }}
                        disabled={a.status === 'approved'}
                        title={a.status === 'approved' ? 'لا يمكن حذف تسوية معتمدة' : 'حذف'}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="تسوية مخزون جديدة"
        subtitle="عدّل رصيد المنتج بسبب تالف، فاقد، فارق جرد، أو غيرها"
        size="2xl"
        icon={<ClipboardList className="w-5 h-5" />}
        footer={
          <>
            <SecondaryButton onClick={() => setShowModal(false)}>إلغاء</SecondaryButton>
            <PrimaryButton type="submit" form="adjustment-form" disabled={saving}>
              {saving ? 'جاري الحفظ…' : 'حفظ التسوية'}
            </PrimaryButton>
          </>
        }
      >
        <form id="adjustment-form" onSubmit={handleSubmit} className="space-y-5">
          <FormError>{formError}</FormError>

          <Section title="المنتج والمخزن">
            <FieldGrid>
              <SelectField
                label="المنتج"
                required
                value={form.productId}
                onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                className="sm:col-span-2"
              >
                <option value="">— اختر المنتج —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} ({p.code}) — رصيد حالي {p.stock.toLocaleString('ar-EG')}
                  </option>
                ))}
              </SelectField>

              {selectedProduct && (
                <div className="sm:col-span-2 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl p-3 text-xs flex items-center gap-2">
                  <Package className="w-4 h-4 flex-shrink-0" />
                  <span>
                    الرصيد الحالي:{' '}
                    <strong className="tabular-nums">
                      {selectedProduct.stock.toLocaleString('ar-EG')}
                    </strong>{' '}
                    {selectedProduct.unit || ''}
                  </span>
                </div>
              )}
            </FieldGrid>
          </Section>

          <Section title="بيانات التسوية">
            <FieldGrid>
              <SelectField
                label="نوع التسوية"
                required
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'increase' | 'decrease' }))}
              >
                <option value="decrease">خصم من المخزون (تالف / فاقد …)</option>
                <option value="increase">إضافة للمخزون (استلام / مردود …)</option>
              </SelectField>

              <Field
                label="الكمية"
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />

              <SelectField
                label="السبب"
                required
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              >
                {REASON_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </SelectField>

              <Field
                label="التاريخ"
                required
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />

              <TextAreaField
                label="ملاحظات"
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="أي ملاحظات إضافية…"
                className="sm:col-span-2"
              />
            </FieldGrid>
          </Section>
        </form>
      </Modal>

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">حذف التسوية</h3>
            <p className="text-sm text-slate-500 mb-3">
              هل أنت متأكد من حذف هذه التسوية؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            {deleteError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />{deleteError}
              </div>
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
    </InventoryLayout>
  );
}
