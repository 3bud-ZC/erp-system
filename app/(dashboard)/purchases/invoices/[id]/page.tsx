'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Printer, Download, Plus, X, CheckCircle, AlertCircle, Wallet } from 'lucide-react';

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

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplier?: {
    nameAr: string;
    nameEn?: string;
    phone?: string;
    address?: string;
    taxNumber?: string;
  };
  date?: string;
  createdAt: string;
  total: number;
  grandTotal?: number;
  paidAmount?: number;
  status: string;
  paymentStatus?: string;
  notes?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
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
  inv: PurchaseInvoice;
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

  const paidAmount = inv.paidAmount ?? 0;
  const remaining  = Math.max(0, grandTotal - paidAmount);
  const payments   = inv.payments ?? [];

  function showSuccess(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowForm(false);
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && showForm) {
        e.preventDefault();
        document.getElementById('pay-submit-p')?.click();
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
          amount: amt, date, type: 'outgoing',
          supplierId:        inv.supplierId,
          purchaseInvoiceId: inv.id,
          notes: notes.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (j.success) {
        showSuccess(`تم تسجيل الدفعة: ${amt.toLocaleString('ar-EG')} ج.م ✓`);
        setAmount(''); setNotes(''); setShowForm(false);
        onPaymentAdded();
      } else { setErr(j.message || j.error || 'فشل الحفظ'); }
    } catch { setErr('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  async function deletePayment(paymentId: string, amt: number) {
    if (!confirm(`حذف الدفعة: ${amt.toLocaleString('ar-EG')} ج.م؟`)) return;
    const res = await fetch(`/api/payments?id=${paymentId}`, { method: 'DELETE', credentials: 'include' });
    const j = await res.json();
    if (j.success) { showSuccess('تم حذف الدفعة'); onPaymentAdded(); }
  }

  const paidPercent = grandTotal > 0 ? Math.min(100, (paidAmount / grandTotal) * 100) : 0;
  const statusLabel = remaining <= 0 ? 'مدفوعة بالكامل' : paidAmount > 0 ? 'مدفوعة جزئياً' : 'غير مدفوعة';
  const statusCls   = remaining <= 0
    ? 'text-green-700 bg-green-50 border-green-200'
    : paidAmount > 0
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-red-700 bg-red-50 border-red-200';
  const barCls      = remaining <= 0 ? 'bg-green-500' : paidAmount > 0 ? 'bg-amber-500' : 'bg-red-400';

  return (
    <div className="no-print bg-white rounded-xl shadow-sm border border-slate-100 p-6 mt-6">
      {toast && (
        <div className="flex items-center gap-2 mb-4 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />{toast}
        </div>
      )}

      {/* Header + Status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <div>
            <h2 className="font-semibold text-slate-900">المدفوعات</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مدفوع:{' '}
              <span className="font-semibold text-green-600 tabular-nums">
                {paidAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </span>
              {' · '}
              متبقي:{' '}
              <span className={`font-semibold tabular-nums ${remaining > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {remaining.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold border px-2.5 py-1 rounded-full ${statusCls}`}>
            {statusLabel}
          </span>
          {remaining > 0 && !showForm && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all">
              <Plus className="w-4 h-4" /> إضافة دفعة
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>نسبة السداد</span>
          <span className="tabular-nums font-medium">{paidPercent.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barCls}`}
            style={{ width: `${paidPercent}%` }}
          />
        </div>
      </div>
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
              <input type="number" min="0.01" step="any" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`أقصى: ${remaining.toLocaleString('ar-EG')}`} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">التاريخ *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ملاحظات</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="مرجع التحويل أو وصف الدفعة…" />
          </div>
          <div className="flex gap-2 pt-1">
            <button id="pay-submit-p" type="submit" disabled={saving}
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
                  {new Date(p.date).toLocaleDateString('ar-EG')}{p.notes ? ` · ${p.notes}` : ''}
                </p>
              </div>
              <button onClick={() => deletePayment(p.id, p.amount)}
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
export default function PurchaseInvoiceDetailPage() {
  const params  = useParams();
  const id      = params?.id as string;

  const [inv,     setInv]     = useState<PurchaseInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  function loadInv() {
    fetch(`/api/purchase-invoices?id=${id}`, { credentials: 'include' })
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
      <Link href="/purchases/invoices" className="text-blue-600 text-sm hover:underline">
        العودة للفواتير
      </Link>
    </div>
  );

  const st         = statusLabels[inv.status] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  const grandTotal = inv.grandTotal ?? inv.total ?? 0;

  function handleDownloadPDF() {
    const prev = document.title;
    document.title = `فاتورة-مشتريات-${inv!.invoiceNumber}`;
    window.print();
    document.title = prev;
  }

  return (
    <>
      {/* Scoped print styles */}
      <style>{`
        @media print {
          body > * { visibility: hidden; }
          #invoice-print, #invoice-print * { visibility: visible; }
          #invoice-print {
            position: fixed; inset: 0; padding: 32px;
            font-family: 'Segoe UI', Tahoma, sans-serif;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div dir="rtl">
        {/* Screen toolbar */}
        <div className="no-print flex items-center justify-between mb-6">
          <Link href="/purchases/invoices"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors group">
            <ArrowRight className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            العودة للفواتير
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 active:scale-95 text-sm font-medium transition-all">
              <Printer className="w-4 h-4" />
              طباعة
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 text-sm font-medium shadow-sm transition-all">
              <Download className="w-4 h-4" />
              تحميل PDF
            </button>
          </div>
        </div>

        {/* Invoice Body */}
        <div id="invoice-print" className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 max-w-4xl mx-auto">

          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-100">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">فاتورة مشتريات</h1>
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

          {/* ── Supplier Info ── */}
          {inv.supplier && (
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">بيانات المورد</h2>
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 text-xs mb-0.5">الاسم</p>
                  <p className="font-semibold text-slate-900">{inv.supplier.nameAr}</p>
                  {inv.supplier.nameEn && <p className="text-slate-500 text-xs">{inv.supplier.nameEn}</p>}
                </div>
                {inv.supplier.phone && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">الهاتف</p>
                    <p className="font-medium text-slate-800">{inv.supplier.phone}</p>
                  </div>
                )}
                {inv.supplier.taxNumber && (
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">الرقم الضريبي</p>
                    <p className="font-medium text-slate-800">{inv.supplier.taxNumber}</p>
                  </div>
                )}
                {inv.supplier.address && (
                  <div className="col-span-full">
                    <p className="text-slate-400 text-xs mb-0.5">العنوان</p>
                    <p className="font-medium text-slate-800">{inv.supplier.address}</p>
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
              <div className="flex justify-between pt-3 border-t-2 border-slate-200 font-bold text-slate-900 text-base">
                <span>إجمالي الفاتورة</span>
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
