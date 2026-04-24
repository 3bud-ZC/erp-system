'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Printer, Plus, X, CheckCircle, AlertCircle } from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface InvoiceItem {
  id: string;
  productId: string;
  product?: { nameAr: string; nameEn?: string; code: string };
  quantity: number;
  price: number;
  total: number;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
  type: string;
  notes?: string;
}

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: {
    nameAr: string;
    nameEn?: string;
    phone?: string;
    address?: string;
    taxNumber?: string;
  };
  date?: string;
  createdAt: string;
  total: number;
  paidAmount?: number;
  payments?: Payment[];
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
  return new Date(d).toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  paid:      { label: 'مدفوعة',  cls: 'bg-green-50 text-green-700 border-green-200' },
  pending:   { label: 'معلقة',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  completed: { label: 'مكتملة',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  cancelled: { label: 'ملغاة',   cls: 'bg-red-50 text-red-600 border-red-200' },
  draft:     { label: 'مسودة',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const paymentLabels: Record<string, string> = {
  cash:          'نقدي',
  credit:        'آجل',
  partial:       'جزئي',
  bank_transfer: 'تحويل بنكي',
  incoming:      'وارد',
  outgoing:      'صادر',
};

/* ─── Payments Panel ─────────────────────────────────────── */
function PaymentsPanel({
  inv, grandTotal, onPaymentAdded,
}: {
  inv: SalesInvoice;
  grandTotal: number;
  onPaymentAdded: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [amount,   setAmount]   = useState('');
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0]);
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [toast,    setToast]    = useState('');

  const paidAmount   = inv.paidAmount ?? 0;
  const remaining    = Math.max(0, grandTotal - paidAmount);
  const payments     = inv.payments ?? [];

  function showSuccess(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // Keyboard shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowForm(false);
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && showForm) {
        e.preventDefault();
        document.getElementById('pay-submit')?.click();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr('أدخل مبلغاً صحيحاً'); return; }
    if (amt > remaining + 0.01) { setErr(`المبلغ يتجاوز الرصيد المتبقي (${remaining.toLocaleString('ar-EG')} ج.م)`); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/payments', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          date,
          type: 'incoming',
          customerId:    inv.customerId,
          salesInvoiceId: inv.id,
          notes: notes.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (j.success) {
        showSuccess(`تم تسجيل الدفعة: ${amt.toLocaleString('ar-EG')} ج.م ✓`);
        setAmount(''); setNotes(''); setShowForm(false);
        onPaymentAdded();
      } else {
        setErr(j.message || j.error || 'فشل الحفظ');
      }
    } catch { setErr('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  async function deletePayment(paymentId: string, amt: number) {
    if (!confirm(`حذف الدفعة: ${amt.toLocaleString('ar-EG')} ج.م؟`)) return;
    const res = await fetch(`/api/payments?id=${paymentId}`, { method: 'DELETE', credentials: 'include' });
    const j = await res.json();
    if (j.success) { showSuccess('تم حذف الدفعة'); onPaymentAdded(); }
  }

  return (
    <div className="no-print bg-white rounded-xl shadow-sm border border-slate-100 p-6 mt-6">
      {toast && (
        <div className="flex items-center gap-2 mb-4 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />{toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-slate-900">المدفوعات</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            مدفوع: <span className="font-medium text-green-600">{paidAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</span>
            {' · '}
            متبقي: <span className={`font-medium ${remaining > 0 ? 'text-red-600' : 'text-slate-500'}`}>
              {remaining.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
            </span>
          </p>
        </div>
        {remaining > 0 && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> إضافة دفعة
          </button>
        )}
        {remaining <= 0 && (
          <span className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
            ✓ مسددة بالكامل
          </span>
        )}
      </div>

      {/* Payment form */}
      {showForm && (
        <form onSubmit={addPayment}
          className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 space-y-3">
          {err && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">المبلغ (ج.م) *</label>
              <input
                type="number" min="0.01" step="any" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`أقصى: ${remaining.toLocaleString('ar-EG')}`}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">التاريخ *</label>
              <input
                type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ملاحظات</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="مرجع التحويل أو وصف الدفعة…"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button id="pay-submit" type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'جاري الحفظ…' : 'تسجيل الدفعة  (Ctrl+Enter)'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setErr(''); }}
              className="px-4 py-2 bg-white text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 border border-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Payment history */}
      {payments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">لم يُسجَّل أي مدفوعات بعد</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between py-2.5 group">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {p.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(p.date).toLocaleDateString('ar-EG')}
                  {p.notes ? ` · ${p.notes}` : ''}
                </p>
              </div>
              <button
                onClick={() => deletePayment(p.id, p.amount)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function SalesInvoiceDetailPage() {
  const params  = useParams();
  const id      = params?.id as string;

  const [inv,     setInv]     = useState<SalesInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  function loadInv() {
    fetch(`/api/sales-invoices?id=${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) setInv(j.data);
        else setError(j.message || 'فشل تحميل الفاتورة');
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (id) { setLoading(true); loadInv(); } }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-slate-500 text-sm">جاري تحميل الفاتورة…</div>
    </div>
  );

  if (error || !inv) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4" dir="rtl">
      <p className="text-red-500 text-sm">{error || 'الفاتورة غير موجودة'}</p>
      <Link href="/sales/invoices" className="text-blue-600 text-sm hover:underline">
        العودة للفواتير
      </Link>
    </div>
  );

  const st         = statusLabels[inv.status] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  const subtotal   = inv.total ?? 0;
  const discount   = inv.discount ?? 0;
  const tax        = inv.tax ?? 0;
  const grandTotal = inv.grandTotal ?? subtotal;

  return (
    <>
      {/* Scoped print styles */}
      <style>{`
        @media print {
          body > * { visibility: hidden; }
          #invoice-print, #invoice-print * { visibility: visible; }
          #invoice-print { position: fixed; inset: 0; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div dir="rtl">
        {/* Screen toolbar */}
        <div className="no-print flex items-center justify-between mb-6">
          <Link href="/sales/invoices"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowRight className="w-4 h-4" />
            العودة للفواتير
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors">
            <Printer className="w-4 h-4" />
            طباعة الفاتورة
          </button>
        </div>

        {/* Invoice Body */}
        <div id="invoice-print" className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 max-w-4xl mx-auto">

          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-100">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">فاتورة مبيعات</h1>
              <p className="text-slate-500 text-sm">
                رقم الفاتورة: <span className="font-semibold text-blue-600">#{inv.invoiceNumber}</span>
              </p>
              <p className="text-slate-500 text-sm mt-0.5">
                التاريخ: <span className="font-medium text-slate-800">{formatDate(inv.date ?? inv.createdAt)}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${st.cls}`}>
                {st.label}
              </span>
              {inv.paymentStatus && (
                <span className="text-xs text-slate-500">
                  طريقة الدفع:{' '}
                  <span className="font-medium text-slate-700">
                    {paymentLabels[inv.paymentStatus] ?? inv.paymentStatus}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* ── Customer Info ── */}
          {inv.customer && (
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">بيانات العميل</h2>
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">الاسم</p>
                  <p className="font-semibold text-slate-900">{inv.customer.nameAr}</p>
                  {inv.customer.nameEn && <p className="text-slate-500 text-xs">{inv.customer.nameEn}</p>}
                </div>
                {inv.customer.phone && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">الهاتف</p>
                    <p className="font-medium text-slate-800">{inv.customer.phone}</p>
                  </div>
                )}
                {inv.customer.taxNumber && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">الرقم الضريبي</p>
                    <p className="font-medium text-slate-800">{inv.customer.taxNumber}</p>
                  </div>
                )}
                {inv.customer.address && (
                  <div className="col-span-full">
                    <p className="text-slate-400 text-xs mb-0.5">العنوان</p>
                    <p className="font-medium text-slate-800">{inv.customer.address}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Items Table ── */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">الأصناف</h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 w-10">#</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">الصنف</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 w-24">الكمية</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 w-36">سعر الوحدة</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 w-36">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(inv.items ?? []).map((item, i) => (
                    <tr key={item.id ?? i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{item.product?.nameAr ?? '—'}</p>
                        {item.product?.code && (
                          <p className="text-xs text-slate-400">{item.product.code}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 tabular-nums">
                        {item.quantity.toLocaleString('ar-EG')}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 tabular-nums">
                        {formatEGP(item.price)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 tabular-nums">
                        {formatEGP(item.total)}
                      </td>
                    </tr>
                  ))}
                  {(inv.items ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-sm">
                        لا توجد أصناف في هذه الفاتورة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Totals ── */}
          <div className="flex justify-end mb-8">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي</span>
                <span className="tabular-nums font-medium">{formatEGP(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>الخصم</span>
                  <span className="tabular-nums">− {formatEGP(discount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>ضريبة القيمة المضافة (14%)</span>
                  <span className="tabular-nums">+ {formatEGP(tax)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t-2 border-slate-200 font-bold text-slate-900 text-base">
                <span>الإجمالي النهائي</span>
                <span className="text-blue-600 tabular-nums">{formatEGP(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          {inv.notes && (
            <div className="border-t border-slate-100 pt-6">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">ملاحظات</h2>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-3">{inv.notes}</p>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="border-t border-slate-100 pt-6 mt-6 text-center">
            <p className="text-xs text-slate-400">شكراً لتعاملكم معنا</p>
          </div>
        </div>

        {/* ── Payments Panel (screen only) ── */}
        <PaymentsPanel inv={inv} grandTotal={grandTotal} onPaymentAdded={loadInv} />
      </div>
    </>
  );
}
