'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplier?: { nameAr: string };
  date?: string;
  createdAt: string;
  total: number;
  grandTotal?: number;
  status: string;
}

interface Supplier { id: string; nameAr: string; code: string; }
interface Product  { id: string; nameAr: string; code: string; price?: number; cost?: number; }

interface InvoiceLine {
  productId: string;
  quantity: string;
  price: string;
}

function emptyLine(): InvoiceLine { return { productId: '', quantity: '1', price: '' }; }

function formatEGP(v?: number) {
  if (v == null) return '—';
  return `${v.toLocaleString('ar-EG')} ج.م`;
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

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate]     = useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch('/api/purchase-invoices', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) setInvoices(j.data ?? []);
        else setError(j.message || 'فشل تحميل الفواتير');
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openModal() {
    // Reset form
    setSupplierId(''); setInvoiceNumber(''); setFormError(null);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setLines([emptyLine()]);
    setShowModal(true);

    // Load suppliers + products in parallel
    fetch('/api/suppliers', { credentials: 'include' })
      .then(r => r.json()).then(j => setSuppliers(j.data ?? []));
    fetch('/api/products', { credentials: 'include' })
      .then(r => r.json()).then(j => setProducts(j.data ?? []));
  }

  function setLine(idx: number, field: keyof InvoiceLine, value: string) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  function addLine() { setLines(prev => [...prev, emptyLine()]); }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)); }

  // Auto-fill price when product selected
  function onProductChange(idx: number, productId: string) {
    const prod = products.find(p => p.id === productId);
    setLines(prev => prev.map((l, i) => i === idx
      ? { ...l, productId, price: prod?.cost != null ? String(prod.cost) : (prod?.price != null ? String(prod.price) : l.price) }
      : l
    ));
  }

  const lineTotal = (l: InvoiceLine) => (parseFloat(l.quantity) || 0) * (parseFloat(l.price) || 0);
  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!supplierId) { setFormError('يرجى اختيار المورد'); return; }
    if (!invoiceNumber.trim()) { setFormError('يرجى إدخال رقم الفاتورة'); return; }
    const validLines = lines.filter(l => l.productId && parseFloat(l.quantity) > 0 && parseFloat(l.price) >= 0);
    if (validLines.length === 0) { setFormError('يرجى إضافة صنف واحد على الأقل'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/purchase-invoices', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          invoiceNumber: invoiceNumber.trim(),
          date: new Date(invoiceDate).toISOString(),
          status: 'pending',
          items: validLines.map(l => ({
            productId: l.productId,
            quantity: parseFloat(l.quantity),
            price: parseFloat(l.price),
          })),
        }),
      });
      const j = await res.json();
      if (j.success) { setShowModal(false); load(); }
      else setFormError(j.message || j.error || 'فشل الحفظ');
    } catch { setFormError('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64" dir="rtl"><div className="text-slate-500">جاري تحميل فواتير المشتريات…</div></div>;
  if (error)   return <div className="flex items-center justify-center h-64" dir="rtl"><div className="text-red-500">{error}</div></div>;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">فواتير المشتريات</h1>
        <button onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> فاتورة جديدة
        </button>
      </div>

      {/* New Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">إنشاء فاتورة مشتريات جديدة</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {formError && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{formError}</div>
              )}

              {/* Header fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المورد *</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">اختر المورد…</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">رقم الفاتورة *</label>
                  <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="PI-2024-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ *</label>
                  <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700">الأصناف *</label>
                  <button type="button" onClick={addLine}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ إضافة صنف</button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500 w-2/5">الصنف</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500 w-1/5">الكمية</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500 w-1/5">السعر (ج.م)</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-500 w-1/5">الإجمالي</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((line, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1.5">
                            <select value={line.productId} onChange={e => onProductChange(idx, e.target.value)}
                              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                              <option value="">اختر صنفاً…</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0.001" step="any" value={line.quantity}
                              onChange={e => setLine(idx, 'quantity', e.target.value)}
                              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="any" value={line.price}
                              onChange={e => setLine(idx, 'price', e.target.value)}
                              className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                              placeholder="0.00" />
                          </td>
                          <td className="px-3 py-1.5 text-slate-700 font-medium tabular-nums">
                            {lineTotal(line) > 0 ? lineTotal(line).toLocaleString('ar-EG') : '—'}
                          </td>
                          <td className="px-1 py-1.5">
                            {lines.length > 1 && (
                              <button type="button" onClick={() => removeLine(idx)}
                                className="text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="bg-slate-50 rounded-lg px-5 py-3 text-right">
                  <span className="text-sm text-slate-500">الإجمالي: </span>
                  <span className="text-lg font-bold text-slate-900">
                    {grandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-1 border-t border-slate-100">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? 'جاري الحفظ…' : 'حفظ الفاتورة'}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-200 transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
          لا توجد فواتير مشتريات حتى الآن
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">رقم الفاتورة</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">المورد</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">المجموع</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الإجمالي</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => {
                const st = statusLabels[inv.status] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-blue-600">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-sm text-slate-800">{inv.supplier?.nameAr ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(inv.date ?? inv.createdAt)}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{formatEGP(inv.total)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">{formatEGP(inv.grandTotal ?? inv.total)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
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
