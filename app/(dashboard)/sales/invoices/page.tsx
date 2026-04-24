'use client';

import { useEffect, useState } from 'react';
import { Plus, Eye, Pencil, Trash2, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';

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

/* ─── View Details Modal ─────────────────────────────────── */
function ViewModal({ inv, onClose }: { inv: SalesInvoice; onClose: () => void }) {
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
          {/* Header info */}
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

          {/* Items */}
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
                        <td className="px-3 py-2 text-slate-600 tabular-nums">{item.quantity.toLocaleString('ar-EG')}</td>
                        <td className="px-3 py-2 text-slate-600 tabular-nums">{formatEGP(item.price)}</td>
                        <td className="px-3 py-2 font-medium text-slate-800 tabular-nums">{formatEGP(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
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

          {/* Notes */}
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
}

/* ─── Edit Status Modal ──────────────────────────────────── */
function EditModal({
  inv, onClose, onSaved,
}: { inv: SalesInvoice; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus]               = useState(inv.status);
  const [paymentStatus, setPaymentStatus] = useState(inv.paymentStatus ?? 'credit');
  const [notes, setNotes]                 = useState(inv.notes ?? '');
  const [saving, setSaving]               = useState(false);
  const [err, setErr]                     = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/sales-invoices', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: inv.id,
          status,
          paymentStatus,
          notes: notes.trim() || undefined,
          // Send existing items unchanged so API doesn't break
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
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
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'جاري الحفظ…' : 'حفظ التعديلات'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Delete Confirm Modal ───────────────────────────────── */
function DeleteModal({ inv, onClose, onDeleted }: { inv: SalesInvoice; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  async function confirm() {
    setDeleting(true); setErr('');
    try {
      const res = await fetch(`/api/sales-invoices?id=${inv.id}`, { method: 'DELETE', credentials: 'include' });
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
            <p className="text-sm text-slate-500 mt-1">
              سيتم حذف هذه الفاتورة نهائياً وعكس أثرها على المخزون والمحاسبة. هذا الإجراء لا يمكن التراجع عنه.
            </p>
          </div>
        </div>
        {err && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{err}</p>}
        <div className="flex gap-3">
          <button onClick={confirm} disabled={deleting}
            className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {deleting ? 'جاري الحذف…' : 'نعم، احذف'}
          </button>
          <button onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [viewInv,   setViewInv]   = useState<SalesInvoice | null>(null);
  const [editInv,   setEditInv]   = useState<SalesInvoice | null>(null);
  const [deleteInv, setDeleteInv] = useState<SalesInvoice | null>(null);

  /* Filters — client-side, seeded from URL params on mount */
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterFrom,     setFilterFrom]     = useState('');
  const [filterTo,       setFilterTo]       = useState('');

  // Seed filter from URL on client
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get('customer');
    if (c) setFilterCustomer(c);
  }, []);

  function load() {
    setLoading(true);
    fetch('/api/sales-invoices', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) setInvoices(j.data ?? []);
        else setError(j.message || 'فشل تحميل الفواتير');
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }

  /* Apply filters */
  const filtered = invoices.filter(inv => {
    if (filterStatus && inv.status !== filterStatus) return false;
    if (filterCustomer && !(inv.customer?.nameAr ?? '').includes(filterCustomer)) return false;
    const d = new Date(inv.date ?? inv.createdAt);
    if (filterFrom && d < new Date(filterFrom)) return false;
    if (filterTo   && d > new Date(filterTo + 'T23:59:59')) return false;
    return true;
  });

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-slate-500 text-sm">جاري تحميل فواتير المبيعات…</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-red-500 text-sm">{error}</div>
    </div>
  );

  return (
    <div dir="rtl">
      {/* Modals */}
      {viewInv   && <ViewModal   inv={viewInv}   onClose={() => setViewInv(null)} />}
      {editInv   && <EditModal   inv={editInv}   onClose={() => setEditInv(null)}   onSaved={load} />}
      {deleteInv && <DeleteModal inv={deleteInv} onClose={() => setDeleteInv(null)} onDeleted={load} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">فواتير المبيعات</h1>
        <Link href="/sales/invoices/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
          <Plus className="w-4 h-4" /> فاتورة جديدة
        </Link>
      </div>

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
              <button
                onClick={() => { setFilterStatus(''); setFilterCustomer(''); setFilterFrom(''); setFilterTo(''); }}
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

      {/* Stats */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {(['pending','completed','paid','cancelled'] as const).map(s => {
            const count = invoices.filter(i => i.status === s).length;
            const { label, cls } = statusLabels[s];
            return (
              <div key={s} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${cls.split(' ')[1]}`}>{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-slate-400 text-sm mb-4">لا توجد فواتير مبيعات حتى الآن</p>
          <Link href="/sales/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus className="w-4 h-4" /> إنشاء أول فاتورة
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center">
          <p className="text-slate-400 text-sm mb-2">لا توجد فواتير تطابق الفلاتر المحددة</p>
          <button
            onClick={() => { setFilterStatus(''); setFilterCustomer(''); setFilterFrom(''); setFilterTo(''); }}
            className="text-sm text-blue-600 hover:underline">
            مسح الفلاتر
          </button>
        </div>
      ) : (
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
              {filtered.map(inv => {
                const st = statusLabels[inv.status] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-600' };
                const pt = paymentLabels[inv.paymentStatus ?? ''] ?? { label: inv.paymentStatus ?? '—', cls: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                      <Link href={`/sales/invoices/${inv.id}`} className="hover:underline">
                        #{inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800">{inv.customer?.nameAr ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDate(inv.date ?? inv.createdAt)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatEGP(inv.grandTotal ?? inv.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${pt.cls}`}>{pt.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setViewInv(inv)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="عرض التفاصيل">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditInv(inv)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="تعديل">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteInv(inv)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="حذف">
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
    </div>
  );
}
