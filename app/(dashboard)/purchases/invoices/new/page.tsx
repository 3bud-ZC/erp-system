'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Trash2, ChevronDown, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/* ─── Types ─────────────────────────────────────────────── */
interface Supplier { id: string; nameAr: string; phone?: string; email?: string; code: string; }
interface Product  { id: string; nameAr: string; code: string; price?: number; cost?: number; stock?: number; unit?: string; }

interface InvoiceLine {
  productId: string;
  description: string;
  quantity: string;
  price: string;
}

/* ─── Toast ──────────────────────────────────────────────── */
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all
      ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {msg}
    </div>
  );
}

/* ─── QuickAddSupplier ───────────────────────────────────── */
function QuickAddSupplier({ onCreated, onClose }: { onCreated: (s: Supplier) => void; onClose: () => void }) {
  const [nameAr, setNameAr] = useState('');
  const [phone,  setPhone]  = useState('');
  const [email,  setEmail]  = useState('');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) { setErr('اسم المورد مطلوب'); return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch('/api/suppliers', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameAr: nameAr.trim(), phone, email, code: 'S' + Date.now() }),
      });
      const j = await r.json();
      if (j.success && j.data) onCreated(j.data);
      else setErr(j.message || j.error || 'فشل الحفظ');
    } catch { setErr('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">إضافة مورد جديد</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={save} className="p-5 space-y-3">
          {err && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم المورد *</label>
            <input value={nameAr} onChange={e => setNameAr(e.target.value)} autoFocus
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="شركة التوريد" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">رقم الهاتف</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="01xxxxxxxxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">البريد الإلكتروني</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="supplier@email.com" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'جاري الحفظ…' : 'إضافة'}
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

/* ─── QuickAddProduct ────────────────────────────────────── */
function QuickAddProduct({ onCreated, onClose }: { onCreated: (p: Product) => void; onClose: () => void }) {
  const [nameAr, setNameAr] = useState('');
  const [code,   setCode]   = useState('');
  const [cost,   setCost]   = useState('');
  const [price,  setPrice]  = useState('');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) { setErr('اسم الصنف مطلوب'); return; }
    if (!code.trim())   { setErr('كود الصنف مطلوب');  return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch('/api/products', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameAr: nameAr.trim(),
          code: code.trim(),
          type: 'raw_material',
          price: parseFloat(price) || 0,
          cost:  parseFloat(cost)  || 0,
          stock: 0,
          unit: 'piece',
        }),
      });
      const j = await r.json();
      if (j.success && j.data) onCreated(j.data);
      else setErr(j.message || j.error || 'فشل الحفظ');
    } catch { setErr('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">إضافة صنف جديد</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={save} className="p-5 space-y-3">
          {err && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم الصنف *</label>
            <input value={nameAr} onChange={e => setNameAr(e.target.value)} autoFocus
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="مواد خام - قطعة" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الكود *</label>
            <input value={code} onChange={e => setCode(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="RAW-001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">سعر التكلفة</label>
              <input value={cost} onChange={e => setCost(e.target.value)} type="number" min="0" step="any"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">سعر البيع</label>
              <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" step="any"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'جاري الحفظ…' : 'إضافة'}
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

/* ─── Helpers ────────────────────────────────────────────── */
function emptyLine(): InvoiceLine { return { productId: '', description: '', quantity: '1', price: '' }; }

function formatEGP(v: number) {
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`;
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function NewPurchaseInvoicePage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Header fields
  const [supplierId,     setSupplierId]     = useState('');
  const [invoiceNumber,  setInvoiceNumber]  = useState('');
  const [invoiceDate,    setInvoiceDate]    = useState(new Date().toISOString().split('T')[0]);
  const [status,         setStatus]         = useState('pending');
  const [paymentStatus,  setPaymentStatus]  = useState('credit');
  const [notes,          setNotes]          = useState('');

  // Line items
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);

  // Quick-add modals
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showAddProduct,  setShowAddProduct]  = useState(false);
  const [addProductLineIdx, setAddProductLineIdx] = useState<number | null>(null);

  // UI state
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast,     setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  /* ── Data load ── */
  useEffect(() => {
    setLoadingData(true);
    Promise.all([
      fetch('/api/suppliers', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/products',  { credentials: 'include' }).then(r => r.json()),
    ]).then(([sj, pj]) => {
      setSuppliers(sj.data ?? []);
      setProducts(pj.data  ?? []);
    }).finally(() => setLoadingData(false));
  }, []);

  /* ── Toast helper ── */
  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  /* ── Line helpers ── */
  function setLine(idx: number, field: keyof InvoiceLine, value: string) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  }

  function onProductChange(idx: number, productId: string) {
    const prod = products.find(p => p.id === productId);
    setLines(prev => prev.map((l, i) => i === idx ? {
      ...l,
      productId,
      price: prod?.cost != null ? String(prod.cost) : (prod?.price != null ? String(prod.price) : l.price),
    } : l));
  }

  function addLine() { setLines(prev => [...prev, emptyLine()]); }
  function removeLine(idx: number) {
    setLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }

  /* ── Calculations ── */
  const lineTotal = (l: InvoiceLine) => (parseFloat(l.quantity) || 0) * (parseFloat(l.price) || 0);
  const subtotal  = lines.reduce((s, l) => s + lineTotal(l), 0);

  /* ── Quick-add callbacks ── */
  function onSupplierCreated(s: Supplier) {
    setSuppliers(prev => [s, ...prev]);
    setSupplierId(s.id);
    setShowAddSupplier(false);
    showToast(`تم إضافة المورد: ${s.nameAr}`, 'success');
  }

  function onProductCreated(p: Product) {
    setProducts(prev => [p, ...prev]);
    if (addProductLineIdx !== null) {
      onProductChange(addProductLineIdx, p.id);
    }
    setShowAddProduct(false);
    setAddProductLineIdx(null);
    showToast(`تم إضافة الصنف: ${p.nameAr}`, 'success');
  }

  /* ── Submit ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!supplierId) { setFormError('يرجى اختيار المورد'); return; }
    const validLines = lines.filter(l => l.productId && parseFloat(l.quantity) > 0 && parseFloat(l.price) >= 0);
    if (validLines.length === 0) { setFormError('يرجى إضافة صنف واحد على الأقل بكمية وسعر صحيحين'); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        supplierId,
        date:          new Date(invoiceDate).toISOString(),
        status,
        paymentStatus,
        notes:         notes.trim() || undefined,
        total:         subtotal,
        items: validLines.map(l => ({
          productId: l.productId,
          quantity:  parseFloat(l.quantity),
          price:     parseFloat(l.price),
          total:     (parseFloat(l.quantity) || 0) * (parseFloat(l.price) || 0),
        })),
      };
      if (invoiceNumber.trim()) payload.invoiceNumber = invoiceNumber.trim();

      const res = await fetch('/api/purchase-invoices', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.success) {
        showToast('تم حفظ فاتورة المشتريات بنجاح ✓', 'success');
        setTimeout(() => router.push('/purchases/invoices'), 1200);
      } else {
        setFormError(j.message || j.error || 'فشل حفظ الفاتورة');
      }
    } catch {
      setFormError('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ── */
  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-slate-500 text-sm">جاري تحميل البيانات…</div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-4xl mx-auto pb-16">
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {showAddSupplier && <QuickAddSupplier onCreated={onSupplierCreated} onClose={() => setShowAddSupplier(false)} />}
      {showAddProduct  && (
        <QuickAddProduct
          onCreated={onProductCreated}
          onClose={() => { setShowAddProduct(false); setAddProductLineIdx(null); }}
        />
      )}

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">فاتورة مشتريات جديدة</h1>
          <p className="text-sm text-slate-500 mt-0.5">أضف فاتورة مشتريات من المورد</p>
        </div>
        <Link href="/purchases/invoices"
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50">
          <ChevronDown className="w-4 h-4 rotate-90" /> العودة للقائمة
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Error banner ── */}
        {formError && (
          <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
          </div>
        )}

        {/* ── Card: Invoice header ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">بيانات الفاتورة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Supplier */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">المورد *</label>
              <div className="flex gap-2">
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">اختر المورد…</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddSupplier(true)}
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs hover:bg-blue-50 hover:text-blue-600 border border-slate-200 transition-colors"
                  title="إضافة مورد جديد">
                  <Plus className="w-3.5 h-3.5" /> جديد
                </button>
              </div>
            </div>

            {/* Invoice number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">رقم الفاتورة</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="PI-2024-001 (اختياري)" />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الفاتورة *</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">حالة الفاتورة</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="pending">معلقة</option>
                <option value="completed">مكتملة</option>
                <option value="draft">مسودة</option>
                <option value="cancelled">ملغاة</option>
              </select>
            </div>

            {/* Payment status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">حالة الدفع</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="credit">آجل</option>
                <option value="cash">نقدي</option>
                <option value="partial">جزئي</option>
                <option value="bank_transfer">تحويل بنكي</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Card: Line items ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <h2 className="text-sm font-semibold text-slate-700">الأصناف</h2>
            <button type="button" onClick={addLine}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors">
              <Plus className="w-3.5 h-3.5" /> إضافة صنف
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-right text-xs font-semibold text-slate-500 w-[35%]">الصنف</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-500 w-[20%]">الوصف</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-500 w-[12%]">الكمية</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-500 w-[15%]">السعر (ج.م)</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-500 w-[13%]">الإجمالي</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lines.map((line, idx) => {
                  const prod = products.find(p => p.id === line.productId);
                  const total = lineTotal(line);
                  return (
                    <tr key={idx} className="group">
                      {/* Product selector */}
                      <td className="py-2 pr-0 pl-2">
                        <div className="flex gap-1">
                          <select value={line.productId} onChange={e => onProductChange(idx, e.target.value)}
                            className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                            <option value="">اختر صنفاً…</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.nameAr}</option>
                            ))}
                          </select>
                          <button type="button"
                            onClick={() => { setAddProductLineIdx(idx); setShowAddProduct(true); }}
                            className="flex-shrink-0 px-1.5 py-1.5 text-slate-400 hover:text-blue-600 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors"
                            title="إضافة صنف جديد">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {prod && (
                          <p className="text-xs text-slate-400 mt-0.5 pr-1">
                            المخزون: {prod.stock?.toLocaleString('ar-EG') ?? '—'} {prod.unit ?? ''}
                          </p>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-2 px-2">
                        <input value={line.description} onChange={e => setLine(idx, 'description', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="ملاحظة" />
                      </td>

                      {/* Quantity */}
                      <td className="py-2 px-2">
                        <input type="number" min="0.001" step="any" value={line.quantity}
                          onChange={e => setLine(idx, 'quantity', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-center" />
                      </td>

                      {/* Price */}
                      <td className="py-2 px-2">
                        <input type="number" min="0" step="any" value={line.price}
                          onChange={e => setLine(idx, 'price', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="0.00" />
                      </td>

                      {/* Line total */}
                      <td className="py-2 px-2 tabular-nums font-medium text-slate-800">
                        {total > 0 ? total.toLocaleString('ar-EG', { minimumFractionDigits: 2 }) : '—'}
                      </td>

                      {/* Remove */}
                      <td className="py-2">
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(idx)}
                            className="text-slate-200 hover:text-red-500 group-hover:text-slate-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add row shortcut */}
          <button type="button" onClick={addLine}
            className="mt-3 w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
            + إضافة صنف آخر
          </button>
        </div>

        {/* ── Card: Notes + Totals ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">ملاحظات</h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="أي ملاحظات إضافية على الفاتورة…" />
          </div>

          {/* Totals summary */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">ملخص الفاتورة</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">المجموع الفرعي</span>
                <span className="font-medium text-slate-800">{formatEGP(subtotal)}</span>
              </div>

              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">إجمالي الفاتورة</span>
                <span className="text-xl font-bold text-blue-600">{formatEGP(subtotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2">
            {saving ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                جاري الحفظ…
              </>
            ) : 'حفظ الفاتورة'}
          </button>
          <Link href="/purchases/invoices"
            className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-3 font-semibold hover:bg-slate-200 transition-colors text-center">
            إلغاء
          </Link>
        </div>

      </form>
    </div>
  );
}
