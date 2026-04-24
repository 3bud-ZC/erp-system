'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Customer { id: string; nameAr: string; nameEn?: string; }
interface Product  { id: string; nameAr: string; code: string; price?: number; }

interface InvoiceLine {
  productId: string;
  quantity: string;
  price: string;
}

function formatEGP(v: number) {
  return `${v.toLocaleString('ar-EG')} ج.م`;
}

const emptyLine = (): InvoiceLine => ({ productId: '', quantity: '1', price: '' });

export default function NewSalesInvoicePage() {
  const router = useRouter();

  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError]   = useState<string | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [status, setStatus] = useState('pending');
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /* ── Load reference data ──────────────────────────────────────────── */
  useEffect(() => {
    Promise.all([
      fetch('/api/customers', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/products', { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([cj, pj]) => {
        if (cj.success) setCustomers(cj.data ?? []);
        else setDataError(cj.message || 'فشل تحميل العملاء');
        if (pj.success) setProducts(pj.data ?? []);
        else setDataError(pj.message || 'فشل تحميل المنتجات');
      })
      .catch(() => setDataError('تعذر الاتصال بالخادم'))
      .finally(() => setLoadingData(false));
  }, []);

  /* ── Line helpers ─────────────────────────────────────────────────── */
  function updateLine(i: number, field: keyof InvoiceLine, val: string) {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: val };
      // Auto-fill price when product changes
      if (field === 'productId') {
        const p = products.find(p => p.id === val);
        if (p?.price != null) updated.price = String(p.price);
      }
      return updated;
    }));
  }

  function addLine()         { setLines(ls => [...ls, emptyLine()]); }
  function removeLine(i: number) {
    if (lines.length > 1) setLines(ls => ls.filter((_, idx) => idx !== i));
  }

  /* ── Totals ───────────────────────────────────────────────────────── */
  const grandTotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const pr  = parseFloat(l.price)    || 0;
    return sum + qty * pr;
  }, 0);

  /* ── Submit ───────────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId)          { setFormError('يجب اختيار العميل'); return; }
    if (lines.some(l => !l.productId)) { setFormError('يجب اختيار المنتج لكل سطر'); return; }
    if (lines.some(l => !(parseFloat(l.quantity) > 0))) {
      setFormError('الكمية يجب أن تكون أكبر من صفر');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch('/api/sales-invoices', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          date: invoiceDate,
          status,
          ...(invoiceNumber.trim() && { invoiceNumber: invoiceNumber.trim() }),
          items: lines.map(l => ({
            productId: l.productId,
            quantity:  parseFloat(l.quantity) || 1,
            price:     parseFloat(l.price)    || 0,
          })),
        }),
      });

      const j = await res.json();
      if (j.success) {
        router.push('/sales/invoices');
      } else {
        setFormError(j.message || j.error || 'فشل إنشاء الفاتورة');
      }
    } catch {
      setFormError('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  if (loadingData) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-slate-500">جاري تحميل البيانات…</div>
    </div>
  );

  if (dataError) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-red-500">{dataError}</div>
    </div>
  );

  const statusLabels: Record<string, string> = {
    pending:   'معلقة',
    paid:      'مدفوعة',
    draft:     'مسودة',
    cancelled: 'ملغاة',
  };

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sales/invoices" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">فاتورة مبيعات جديدة</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">
            {formError}
          </div>
        )}

        {/* Header fields */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">بيانات الفاتورة</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">العميل *</label>
              <select
                required
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— اختر العميل —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.nameAr}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ *</label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">رقم الفاتورة</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="يُنشأ تلقائياً"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الحالة</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(statusLabels).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800">بنود الفاتورة</h2>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" /> إضافة سطر
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">المنتج</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-24">الكمية</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-32">سعر الوحدة</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-32">الإجمالي</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, i) => {
                  const qty = parseFloat(line.quantity) || 0;
                  const pr  = parseFloat(line.price)    || 0;
                  const sub = qty * pr;
                  return (
                    <tr key={i}>
                      <td className="px-2 py-1.5">
                        <select
                          value={line.productId}
                          onChange={e => updateLine(i, 'productId', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">— اختر المنتج —</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.nameAr} ({p.code})</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={e => updateLine(i, 'quantity', e.target.value)}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.price}
                          onChange={e => updateLine(i, 'price', e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">
                        {sub > 0 ? sub.toLocaleString('ar-EG') : '—'}
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          disabled={lines.length === 1}
                          className="text-slate-300 hover:text-red-500 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-slate-700 text-left">
                    الإجمالي الكلي
                  </td>
                  <td colSpan={2} className="px-3 py-2 text-sm font-bold text-slate-900">
                    {formatEGP(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'جاري الحفظ…' : 'حفظ الفاتورة'}
          </button>
          <Link
            href="/sales/invoices"
            className="flex-1 text-center bg-slate-100 text-slate-700 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
