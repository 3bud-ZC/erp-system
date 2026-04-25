'use client';

import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { Plus, Eye, Pencil, Trash2, X, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { TableSkeleton, ErrorBanner } from '@/components/ui/patterns';

/* ─── Constants ──────────────────────────────────────────── */
const PAGE_SIZE  = 20;
const TABLE_COLS = ['w-24', 'w-32', 'w-20', 'w-24', 'w-16', 'w-16', 'w-12'];

/* ─── Types ──────────────────────────────────────────────── */
interface InvoiceItem {
  id: string;
  productId: string;
  product?: { nameAr: string; code: string };
  quantity: number;
  price: number;
  total: number;
}

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplier?: { nameAr: string };
  date?: string;
  createdAt: string;
  total: number;
  grandTotal?: number;
  status: string;
  paymentStatus?: string;
  notes?: string;
  items?: InvoiceItem[];
}

/* ─── Helpers ────────────────────────────────────────────── */
function formatEGP(v?: number | null) {
  if (v == null) return '—';
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`;
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG');
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  paid:      { label: 'مدفوعة',  cls: 'bg-green-50 text-green-700' },
  pending:   { label: 'معلقة',   cls: 'bg-yellow-50 text-yellow-700' },
  completed: { label: 'مكتملة',  cls: 'bg-blue-50 text-blue-700' },
  cancelled: { label: 'ملغاة',   cls: 'bg-red-50 text-red-600' },
  draft:     { label: 'مسودة',   cls: 'bg-slate-100 text-slate-600' },
};

const paymentLabels: Record<string, { label: string; cls: string }> = {
  cash:          { label: 'نقدي',        cls: 'bg-emerald-50 text-emerald-700' },
  credit:        { label: 'آجل',         cls: 'bg-orange-50 text-orange-700' },
  partial:       { label: 'جزئي',        cls: 'bg-purple-50 text-purple-700' },
  bank_transfer: { label: 'تحويل بنكي', cls: 'bg-sky-50 text-sky-700' },
};

/* ─── Pagination ─────────────────────────────────────────── */
const Pagination = memo(function Pagination({
  page, totalPages, onPage,
}: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages = useMemo(() => {
    const all = Array.from({ length: totalPages }, (_, i) => i + 1);
    const visible = all.filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
    // insert ellipsis markers
    const result: (number | '…')[] = [];
    let prev = 0;
    for (const p of visible) {
      if (p - prev > 1) result.push('…');
      result.push(p);
      prev = p;
    }
    return result;
  }, [totalPages, page]);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 mt-4 py-3">
      <button disabled={page === 1} onClick={() => onPage(page - 1)}
        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm select-none">…</span>
        ) : (
          <button key={p} onClick={() => onPage(p as number)}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
              p === page ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {p}
          </button>
        )
      )}
      <button disabled={page === totalPages} onClick={() => onPage(page + 1)}
        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
});

/* ─── View Modal ─────────────────────────────────────────── */
const ViewModal = memo(function ViewModal({
  inv, onClose,
}: { inv: PurchaseInvoice; onClose: () => void }) {
  const st = statusLabels[inv.status] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-600' };
  const pt = paymentLabels[inv.paymentStatus ?? ''] ?? { label: inv.paymentStatus ?? '—', cls: 'bg-slate-100 text-slate-600' };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">فاتورة مشتريات #{inv.invoiceNumber}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{formatDate(inv.date ?? inv.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500 mb-0.5">المورد</p>
              <p className="font-semibold text-slate-900">{inv.supplier?.nameAr ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">حالة الفاتورة</p>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
            </div>
            <div>
              <p className="text-slate-500 mb-0.5">حالة الدفع</p>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${pt.cls}`}>{pt.label}</span>
            </div>
          </div>

          {inv.items && inv.items.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">الأصناف</p>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">الصنف</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">الكمية</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">السعر</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inv.items.map((item, i) => (
                      <tr key={item.id ?? i}>
                        <td className="px-3 py-2 text-slate-800">{item.product?.nameAr ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600 tabular-nums">{(item.quantity ?? 0).toLocaleString('ar-EG')}</td>
                        <td className="px-3 py-2 text-slate-600 tabular-nums">{formatEGP(item.price)}</td>
                        <td className="px-3 py-2 font-medium text-slate-800 tabular-nums">{formatEGP(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-4 text-sm">
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
              <span>إجمالي الفاتورة</span>
              <span className="text-blue-600 text-base">{formatEGP(inv.grandTotal ?? inv.total)}</span>
            </div>
          </div>

          {inv.notes && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-1">ملاحظات</p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{inv.notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end p-5 border-t border-slate-100">
          <button onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
});

/* ─── Edit Modal ─────────────────────────────────────────── */
const EditModal = memo(function EditModal({
  inv, onClose, onSaved,
}: { inv: PurchaseInvoice; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus]               = useState(inv.status);
  const [paymentStatus, setPaymentStatus] = useState(inv.paymentStatus ?? 'credit');
  const [notes, setNotes]                 = useState(inv.notes ?? '');
  const [saving, setSaving]               = useState(false);
  const [err, setErr]                     = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/purchase-invoices', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: inv.id,
          status,
          paymentStatus,
          notes: notes.trim() || undefined,
          items: (inv.items ?? []).map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
            total: i.total,
          })),
        }),
      });
      const j = await res.json();
      if (j.success) { onSaved(); onClose(); }
      else setErr(j.message || j.error || 'فشل الحفظ');
    } catch { setErr('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">تعديل الفاتورة #{inv.invoiceNumber}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={save} className="p-5 space-y-4">
          {err && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{err}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">حالة الفاتورة</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="draft">مسودة</option>
              <option value="pending">معلقة</option>
              <option value="completed">مكتملة</option>
              <option value="paid">مدفوعة</option>
              <option value="cancelled">ملغاة</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">حالة الدفع</label>
            <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="cash">نقدي</option>
              <option value="credit">آجل</option>
              <option value="partial">جزئي</option>
              <option value="bank_transfer">تحويل بنكي</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="ملاحظات إضافية…" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'جاري الحفظ…' : 'حفظ التعديلات'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200 transition-colors">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

/* ─── Delete Modal ───────────────────────────────────────── */
const DeleteModal = memo(function DeleteModal({
  inv, onClose, onDeleted,
}: { inv: PurchaseInvoice; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  async function confirm() {
    setDeleting(true); setErr('');
    try {
      const res = await fetch(`/api/purchase-invoices?id=${inv.id}`, { method: 'DELETE', credentials: 'include' });
      const j = await res.json();
      if (j.success) { onDeleted(); onClose(); }
      else setErr(j.message || j.error || 'فشل الحذف');
    } catch { setErr('تعذر الاتصال بالخادم'); }
    finally { setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">حذف الفاتورة #{inv.invoiceNumber}</h3>
            <p className="text-sm text-slate-500 mt-1">سيتم حذف هذه الفاتورة نهائياً وعكس أثرها على المخزون. هذا الإجراء لا يمكن التراجع عنه.</p>
          </div>
        </div>
        {err && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{err}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={confirm} disabled={deleting}
            className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
            {deleting ? 'جاري الحذف…' : 'نعم، احذف'}
          </button>
          <button onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200 transition-colors">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
});

/* ─── Invoice Row ────────────────────────────────────────── */
const InvoiceRow = memo(function InvoiceRow({
  inv, onView, onEdit, onDelete,
}: {
  inv: PurchaseInvoice;
  onView: (inv: PurchaseInvoice) => void;
  onEdit: (inv: PurchaseInvoice) => void;
  onDelete: (inv: PurchaseInvoice) => void;
}) {
  const st = statusLabels[inv.status] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-600' };
  const pt = paymentLabels[inv.paymentStatus ?? ''] ?? { label: inv.paymentStatus ?? '—', cls: 'bg-slate-100 text-slate-600' };

  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td className="px-4 py-3 text-sm font-semibold text-blue-600">
        <Link href={`/purchases/invoices/${inv.id}`} className="hover:underline">
          #{inv.invoiceNumber}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-slate-800">{inv.supplier?.nameAr ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-500 tabular-nums">{formatDate(inv.date ?? inv.createdAt)}</td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-900 tabular-nums">{formatEGP(inv.grandTotal ?? inv.total)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${pt.cls}`}>{pt.label}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onView(inv)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="عرض التفاصيل">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => onEdit(inv)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            title="تعديل">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(inv)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="حذف">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});

/* ─── Main Page ──────────────────────────────────────────── */
export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [page,     setPage]     = useState(1);

  const [viewInv,   setViewInv]   = useState<PurchaseInvoice | null>(null);
  const [editInv,   setEditInv]   = useState<PurchaseInvoice | null>(null);
  const [deleteInv, setDeleteInv] = useState<PurchaseInvoice | null>(null);

  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterFrom,     setFilterFrom]     = useState('');
  const [filterTo,       setFilterTo]       = useState('');

  // Seed filter from URL on mount
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('supplier');
    if (s) setFilterSupplier(s);
  }, []);

  // Stable fetch — won't change between renders
  const load = useCallback(() => {
    setLoading(true); setError(null);
    fetch('/api/purchase-invoices', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) setInvoices(j.data ?? []);
        else setError(j.message || 'فشل تحميل الفواتير');
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterStatus, filterSupplier, filterFrom, filterTo]);

  /* ── Memoized derivations ── */
  const filtered = useMemo(() => invoices.filter(inv => {
    if (filterStatus && inv.status !== filterStatus) return false;
    if (filterSupplier && !(inv.supplier?.nameAr ?? '').includes(filterSupplier)) return false;
    const d = new Date(inv.date ?? inv.createdAt);
    if (filterFrom && d < new Date(filterFrom)) return false;
    if (filterTo   && d > new Date(filterTo + 'T23:59:59')) return false;
    return true;
  }), [invoices, filterStatus, filterSupplier, filterFrom, filterTo]);

  const stats = useMemo(() => ({
    pending:   invoices.filter(i => i.status === 'pending').length,
    completed: invoices.filter(i => i.status === 'completed').length,
    paid:      invoices.filter(i => i.status === 'paid').length,
    cancelled: invoices.filter(i => i.status === 'cancelled').length,
  }), [invoices]);

  const totalPages = useMemo(() => Math.ceil(filtered.length / PAGE_SIZE), [filtered.length]);
  const paginated  = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  /* ── Stable callbacks ── */
  const handleView   = useCallback((inv: PurchaseInvoice) => setViewInv(inv),   []);
  const handleEdit   = useCallback((inv: PurchaseInvoice) => setEditInv(inv),   []);
  const handleDelete = useCallback((inv: PurchaseInvoice) => setDeleteInv(inv), []);
  const closeView    = useCallback(() => setViewInv(null),   []);
  const closeEdit    = useCallback(() => setEditInv(null),   []);
  const closeDelete  = useCallback(() => setDeleteInv(null), []);
  const clearFilters = useCallback(() => {
    setFilterStatus(''); setFilterSupplier(''); setFilterFrom(''); setFilterTo('');
  }, []);

  /* ── Loading / error states ── */
  if (loading) return <TableSkeleton cols={TABLE_COLS} />;
  if (error)   return <ErrorBanner message={error} onRetry={load} />;

  const hasFilters = !!(filterStatus || filterSupplier || filterFrom || filterTo);

  return (
    <div dir="rtl">
      {/* Modals */}
      {viewInv   && <ViewModal   inv={viewInv}   onClose={closeView} />}
      {editInv   && <EditModal   inv={editInv}   onClose={closeEdit}   onSaved={load} />}
      {deleteInv && <DeleteModal inv={deleteInv} onClose={closeDelete} onDeleted={load} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">فواتير المشتريات</h1>
          {invoices.length > 0 && (
            <p className="text-sm text-slate-400 mt-0.5">{invoices.length} فاتورة إجمالاً</p>
          )}
        </div>
        <Link href="/purchases/invoices/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
          <Plus className="w-4 h-4" /> فاتورة جديدة
        </Link>
      </div>

      {/* Stat Cards — clickable quick-filter */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {(
            [
              { key: 'pending',   count: stats.pending,   ...statusLabels.pending   },
              { key: 'completed', count: stats.completed, ...statusLabels.completed },
              { key: 'paid',      count: stats.paid,      ...statusLabels.paid      },
              { key: 'cancelled', count: stats.cancelled, ...statusLabels.cancelled },
            ] as const
          ).map(({ key, count, label, cls }) => {
            const active = filterStatus === key;
            return (
              <button key={key}
                onClick={() => setFilterStatus(active ? '' : key)}
                className={`bg-white rounded-xl border shadow-sm px-4 py-3 text-right w-full transition-all ${
                  active ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200'
                }`}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${cls.split(' ')[1]}`}>{count}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Bar */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 mb-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">الحالة</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">كل الحالات</option>
              <option value="draft">مسودة</option>
              <option value="pending">معلقة</option>
              <option value="completed">مكتملة</option>
              <option value="paid">مدفوعة</option>
              <option value="cancelled">ملغاة</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">المورد</label>
            <input type="text" value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
              placeholder="ابحث باسم المورد…"
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">من تاريخ</label>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">إلى تاريخ</label>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            {hasFilters && (
              <button onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap">
                مسح الفلاتر
              </button>
            )}
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {filtered.length} من {invoices.length} فاتورة
            </span>
          </div>
        </div>
      )}

      {/* Empty / No-results / Table */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-slate-400 text-sm mb-4">لا توجد فواتير مشتريات حتى الآن</p>
          <Link href="/purchases/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> إنشاء أول فاتورة
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
          <p className="text-slate-400 text-sm mb-2">لا توجد فواتير تطابق الفلاتر المحددة</p>
          <button onClick={clearFilters} className="text-sm text-blue-600 hover:underline">
            مسح الفلاتر
          </button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">رقم الفاتورة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">المورد</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">الإجمالي</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">الحالة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">الدفع</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map(inv => (
                  <InvoiceRow
                    key={inv.id}
                    inv={inv}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
