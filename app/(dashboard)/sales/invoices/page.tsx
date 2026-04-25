'use client';

import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import { Plus, Eye, Pencil, Trash2, X, AlertCircle, ChevronRight, ChevronLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { TableSkeleton } from '@/components/ui/patterns';

/* ─── Types ─────────────────────────────────────────────── */
interface InvoiceItem {
  id: string;
  productId: string;
  product?: { nameAr: string; code: string };
  quantity: number;
  price: number;
  total: number;
}

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customer?: { nameAr: string };
  date?: string;
  createdAt: string;
  total: number;
  discount?: number;
  tax?: number;
  grandTotal?: number;
  status: string;
  paymentStatus?: string;
  notes?: string;
  items?: InvoiceItem[];
}

/* ─── Constants ──────────────────────────────────────────── */
const PAGE_SIZE   = 20;
const TABLE_COLS  = ['w-20', 'w-28', 'w-16', 'w-24', 'w-16', 'w-16', 'w-12'];

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
  cash:          { label: 'نقدي',       cls: 'bg-emerald-50 text-emerald-700' },
  credit:        { label: 'آجل',        cls: 'bg-orange-50 text-orange-700' },
  partial:       { label: 'جزئي',       cls: 'bg-purple-50 text-purple-700' },
  bank_transfer: { label: 'تحويل بنكي', cls: 'bg-sky-50 text-sky-700' },
};

/* ─── Pagination ─────────────────────────────────────────── */
const Pagination = memo(function Pagination({
  page, totalPages, onPage,
}: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const pages = useMemo(() => {
    const all = Array.from({ length: totalPages }, (_, i) => i + 1);
    return all.filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
  }, [totalPages, page]);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>

      {pages.map((p, i) => {
        const prev = pages[i - 1];
        const showEllipsis = typeof prev === 'number' && p - prev > 1;
        return (
          <span key={p} className="flex items-center gap-1">
            {showEllipsis && <span className="px-1 text-slate-400 text-sm">…</span>}
            <button
              onClick={() => onPage(p)}
              className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                page === p
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          </span>
        );
      })}

      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  );
});

/* ─── View Details Modal ─────────────────────────────────── */
const ViewModal = memo(function ViewModal({ inv, onClose }: { inv: SalesInvoice; onClose: () => void }) {
  const st = statusLabels[inv.status] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-600' };
  const pt = paymentLabels[inv.paymentStatus ?? ''] ?? { label: inv.paymentStatus ?? '—', cls: 'bg-slate-100 text-slate-600' };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">فاتورة #{inv.invoiceNumber}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{formatDate(inv.date ?? inv.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500 mb-0.5">العميل</p>
              <p className="font-semibold text-slate-900">{inv.customer?.nameAr ?? '—'}</p>
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

          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">المجموع الفرعي</span>
              <span className="font-medium text-slate-800">{formatEGP(inv.total)}</span>
            </div>
            {inv.discount != null && inv.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>الخصم</span>
                <span>− {formatEGP(inv.discount)}</span>
              </div>
            )}
            {inv.tax != null && inv.tax > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>الضريبة (14%)</span>
                <span>+ {formatEGP(inv.tax)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
              <span>الإجمالي</span>
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

/* ─── Edit Status Modal ──────────────────────────────────── */
const EditModal = memo(function EditModal({
  inv, onClose, onSaved,
}: { inv: SalesInvoice; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus]               = useState(inv.status);
  const [paymentStatus, setPaymentStatus] = useState(inv.paymentStatus ?? 'credit');
  const [notes, setNotes]                 = useState(inv.notes ?? '');
  const [saving, setSaving]               = useState(false);
  const [err, setErr]                     = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      id: inv.id, status, paymentStatus,
      notes: notes.trim() || undefined,
      items: (inv.items ?? []).map(i => ({
        productId: i.productId, quantity: i.quantity, price: i.price, total: i.total,
      })),
    };
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/sales-invoices', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.success) { onSaved(); onClose(); }
      else setErr(j.message || j.error || 'فشل الحفظ');
    } catch {
      setErr('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-slideUp">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">تعديل الفاتورة #{inv.invoiceNumber}</h2>
          <button 
            onClick={onClose} 
            disabled={saving}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
          >
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
          <div className="flex gap-3 pt-2">
            <button 
              type="submit" 
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-2"
            >
              {saving && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {saving ? 'جاري الحفظ…' : 'حفظ التعديلات'}
            </button>
            <button 
              type="button" 
              onClick={onClose}
              disabled={saving}
              className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

/* ─── Delete Confirm Modal ───────────────────────────────── */
const DeleteModal = memo(function DeleteModal({
  inv, onClose, onDeleted,
}: { inv: SalesInvoice; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  async function confirm() {
    setDeleting(true); setErr('');
    try {
      const res = await fetch(`/api/sales-invoices?id=${inv.id}`, {
        method: 'DELETE', credentials: 'include',
      });
      const j = await res.json();
      if (j.success) { onDeleted(); onClose(); }
      else setErr(j.message || j.error || 'فشل الحذف');
    } catch {
      setErr('تعذر الاتصال بالخادم');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-slideUp">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">حذف الفاتورة #{inv.invoiceNumber}</h3>
            <p className="text-sm text-slate-500 mt-1">
              سيتم حذف هذه الفاتورة نهائياً وعكس أثرها على المخزون والمحاسبة. هذا الإجراء لا يمكن التراجع عنه.
            </p>
          </div>
        </div>
        {err && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {err}
          </div>
        )}
        <div className="flex gap-3">
          <button 
            onClick={confirm} 
            disabled={deleting}
            className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-2"
          >
            {deleting && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {deleting ? 'جاري الحذف…' : 'نعم، احذف'}
          </button>
          <button 
            onClick={onClose}
            disabled={deleting}
            className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
});

/* ─── Memoized Table Row ─────────────────────────────────── */
const InvoiceRow = memo(function InvoiceRow({
  inv, onView, onEdit, onDelete,
}: {
  inv: SalesInvoice;
  onView: (inv: SalesInvoice) => void;
  onEdit: (inv: SalesInvoice) => void;
  onDelete: (inv: SalesInvoice) => void;
}) {
  const st = statusLabels[inv.status] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-600' };
  const pt = paymentLabels[inv.paymentStatus ?? ''] ?? { label: inv.paymentStatus ?? '—', cls: 'bg-slate-100 text-slate-600' };

  return (
    <tr className="hover:bg-slate-50 transition-colors group">
      <td className="px-4 py-3 text-sm font-semibold text-blue-600">
        <Link href={`/sales/invoices/${inv.id}`} className="hover:underline">
          #{inv.invoiceNumber}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-slate-800">{inv.customer?.nameAr ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-500 tabular-nums">{formatDate(inv.date ?? inv.createdAt)}</td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-900 tabular-nums">
        {formatEGP(inv.grandTotal ?? inv.total)}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${pt.cls}`}>{pt.label}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
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
export default function SalesInvoicesPage() {
  const invoicesQ = useQuery({
    queryKey: queryKeys.salesInvoices,
    queryFn: () => apiGet<SalesInvoice[]>('/api/sales-invoices'),
    staleTime: 30_000,
  });
  const invoices = useMemo(() => invoicesQ.data ?? [], [invoicesQ.data]);
  const loading = invoicesQ.isLoading;
  const error = invoicesQ.error ? (invoicesQ.error as Error).message : null;
  const load = useCallback(() => { invoicesQ.refetch(); }, [invoicesQ]);

  const [page, setPage] = useState(1);

  const [viewInv,   setViewInv]   = useState<SalesInvoice | null>(null);
  const [editInv,   setEditInv]   = useState<SalesInvoice | null>(null);
  const [deleteInv, setDeleteInv] = useState<SalesInvoice | null>(null);

  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterFrom,     setFilterFrom]     = useState('');
  const [filterTo,       setFilterTo]       = useState('');

  /* Seed filter from URL on mount */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get('customer');
    if (c) setFilterCustomer(c);
  }, []);

  /* Reset to page 1 whenever filters change */
  useEffect(() => { setPage(1); }, [filterStatus, filterCustomer, filterFrom, filterTo]);

  /* ── Memoized derived values ── */
  const filtered = useMemo(() => invoices.filter(inv => {
    if (filterStatus && inv.status !== filterStatus) return false;
    if (filterCustomer && !(inv.customer?.nameAr ?? '').includes(filterCustomer)) return false;
    const d = new Date(inv.date ?? inv.createdAt);
    if (filterFrom && d < new Date(filterFrom)) return false;
    if (filterTo   && d > new Date(filterTo + 'T23:59:59')) return false;
    return true;
  }), [invoices, filterStatus, filterCustomer, filterFrom, filterTo]);

  const stats = useMemo(() => ({
    pending:   invoices.filter(i => i.status === 'pending').length,
    completed: invoices.filter(i => i.status === 'completed').length,
    paid:      invoices.filter(i => i.status === 'paid').length,
    cancelled: invoices.filter(i => i.status === 'cancelled').length,
  }), [invoices]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  /* ── Stable callbacks (prevent child re-renders) ── */
  const clearFilters = useCallback(() => {
    setFilterStatus(''); setFilterCustomer(''); setFilterFrom(''); setFilterTo('');
  }, []);

  const handleView   = useCallback((inv: SalesInvoice) => setViewInv(inv),   []);
  const handleEdit   = useCallback((inv: SalesInvoice) => setEditInv(inv),   []);
  const handleDelete = useCallback((inv: SalesInvoice) => setDeleteInv(inv), []);
  const closeView    = useCallback(() => setViewInv(null),   []);
  const closeEdit    = useCallback(() => setEditInv(null),   []);
  const closeDelete  = useCallback(() => setDeleteInv(null), []);

  /* ── Loading skeleton ── */
  if (loading) return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-36 bg-slate-200 animate-pulse rounded-lg" />
          <div className="h-4 w-24 bg-slate-100 animate-pulse rounded" />
        </div>
        <div className="h-9 w-28 bg-slate-200 animate-pulse rounded-lg" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
            <div className="h-3 w-12 bg-slate-200 animate-pulse rounded mb-2" />
            <div className="h-6 w-8 bg-slate-200 animate-pulse rounded" />
          </div>
        ))}
      </div>
      <TableSkeleton cols={TABLE_COLS} />
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3" dir="rtl">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={load}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
        إعادة المحاولة
      </button>
    </div>
  );

  return (
    <div dir="rtl" className="space-y-4">
      {/* Modals */}
      {viewInv   && <ViewModal   inv={viewInv}   onClose={closeView} />}
      {editInv   && <EditModal   inv={editInv}   onClose={closeEdit}   onSaved={load} />}
      {deleteInv && <DeleteModal inv={deleteInv} onClose={closeDelete} onDeleted={load} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">فواتير المبيعات</h1>
          <p className="text-sm text-slate-500 mt-0.5">{invoices.length} فاتورة إجمالاً</p>
        </div>
        <Link href="/sales/invoices/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
          <Plus className="w-4 h-4" /> فاتورة جديدة
        </Link>
      </div>

      {/* Clickable stat cards — act as quick filters */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['pending', 'completed', 'paid', 'cancelled'] as const).map(s => {
            const { label, cls } = statusLabels[s];
            const active = filterStatus === s;
            return (
              <button key={s}
                onClick={() => setFilterStatus(active ? '' : s)}
                className={`bg-white rounded-xl border shadow-sm px-4 py-3 text-right transition-all ${
                  active ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200 hover:shadow'
                }`}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${cls.split(' ')[1]}`}>{stats[s]}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Bar */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex flex-wrap items-end gap-3">
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
            <label className="block text-xs font-medium text-slate-500 mb-1">العميل</label>
            <input type="text" value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}
              placeholder="ابحث باسم العميل…"
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
            {(filterStatus || filterCustomer || filterFrom || filterTo) && (
              <button onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap">
                مسح ×
              </button>
            )}
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {filtered.length} من {invoices.length} فاتورة
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
          <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm mb-4">لا توجد فواتير مبيعات حتى الآن</p>
          <Link href="/sales/invoices/new"
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
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">العميل</th>
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

          {/* Pagination bar */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              عرض {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} من {filtered.length}
            </span>
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
