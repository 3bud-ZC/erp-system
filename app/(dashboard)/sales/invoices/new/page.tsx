'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowRight, X, Check, Percent, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

/* ─── Types ────────────────────────────────────────────────────── */
interface Customer { id: string; nameAr: string; phone?: string; }
interface Product  { id: string; nameAr: string; code: string; price?: number; stock?: number; }
interface UserOpt  { id: string; name?: string | null; email: string; }

interface InvoiceLine {
  productId: string;
  description: string;
  quantity: string;
  price: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function fmt(v: number) { return v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const emptyLine = (): InvoiceLine => ({ productId: '', description: '', quantity: '1', price: '' });

/* ─── Quick-Add Customer Modal ──────────────────────────────────────── */
function QuickAddCustomer({ onCreated, onClose }: { onCreated: (c: Customer) => void; onClose: () => void; }) {
  const [nameAr, setNameAr] = useState('');
  const [phone, setPhone]   = useState('');
  const [email, setEmail]   = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) { setErr('اسم العميل مطلوب'); return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch('/api/customers', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameAr: nameAr.trim(), phone: phone.trim(), email: email.trim(),
          code: `C${Date.now().toString().slice(-6)}` }),
      });
      const j = await r.json();
      if (j.success) { onCreated(j.data); }
      else setErr(j.message || 'فشل إنشاء العميل');
    } catch { setErr('تعذر الاتصال'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-slate-800">إضافة عميل جديد</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          {err && <p className="text-red-600 text-xs bg-red-50 p-2 rounded">{err}</p>}
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">الاسم *</label>
            <input autoFocus value={nameAr} onChange={e => setNameAr(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="اسم العميل" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">الهاتف</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="01xxxxxxxxx" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">البريد الإلكتروني</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example@email.com" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'جاري الحفظ…' : 'حفظ'}
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

/* ─── Quick-Add Product Modal ──────────────────────────────────────── */
function QuickAddProduct({ onCreated, onClose }: { onCreated: (p: Product) => void; onClose: () => void; }) {
  const [nameAr, setNameAr] = useState('');
  const [code, setCode]     = useState('');
  const [price, setPrice]   = useState('');
  const [cost, setCost]     = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameAr.trim()) { setErr('اسم المنتج مطلوب'); return; }
    if (!code.trim()) { setErr('كود المنتج مطلوب'); return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch('/api/products', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameAr: nameAr.trim(), code: code.trim().toUpperCase(),
          type: 'finished_product',
          price: parseFloat(price) || 0,
          cost: parseFloat(cost) || 0,
          stock: 0, unit: 'piece',
        }),
      });
      const j = await r.json();
      if (j.success) { onCreated(j.data); }
      else setErr(j.message || 'فشل إنشاء المنتج');
    } catch { setErr('تعذر الاتصال'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-slate-800">إضافة منتج جديد</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          {err && <p className="text-red-600 text-xs bg-red-50 p-2 rounded">{err}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">الاسم *</label>
              <input autoFocus value={nameAr} onChange={e => setNameAr(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="اسم المنتج" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">الكود *</label>
              <input value={code} onChange={e => setCode(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="PRD-001" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">سعر البيع</label>
              <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">التكلفة</label>
              <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'جاري الحفظ…' : 'حفظ'}
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

/* ─── Toast ─────────────────────────────────────────────────────────── */
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-sm font-medium
      ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {msg}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function NewSalesInvoicePage() {
  const router = useRouter();

  /* Reference data */
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError]     = useState('');

  /* Form state */
  const [customerId, setCustomerId]     = useState('');
  const [invoiceDate, setInvoiceDate]   = useState(new Date().toISOString().split('T')[0]);
  const [issueDate, setIssueDate]       = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [status, setStatus]             = useState('pending');
  const [paymentStatus, setPaymentStatus] = useState('cash');
  const [lines, setLines]               = useState<InvoiceLine[]>([emptyLine()]);
  const [notes, setNotes]               = useState('');
  /* New fields (Phase: invoice form upgrade) */
  const [users, setUsers]               = useState<UserOpt[]>([]);
  const [salesRepId, setSalesRepId]     = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('0');
  const [currency, setCurrency]         = useState('EGP');
  const [template, setTemplate]         = useState('default');

  /* Discount */
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');

  /* Tax */
  const [taxEnabled, setTaxEnabled] = useState(false);
  const TAX_RATE = 0.14; // 14% Egyptian VAT

  /* UI modals & feedback */
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddProduct, setShowAddProduct]   = useState(false);
  const [addProductLineIdx, setAddProductLineIdx] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saveMode, setSaveMode] = useState<'draft' | 'confirm' | 'new' | 'print'>('confirm');
  const [toast, setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [formError, setFormError] = useState('');

  /* ── Load reference data ── */
  useEffect(() => {
    Promise.all([
      fetch('/api/customers', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/products', { credentials: 'include' }).then(r => r.json()),
      // /api/users is optional — if it fails, the salesRep dropdown stays empty
      // (just an empty option) instead of breaking the whole page.
      fetch('/api/users', { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([cj, pj, uj]) => {
      if (cj.success) setCustomers(cj.data ?? []);
      if (pj.success) setProducts(pj.data ?? []);
      if (uj && uj.success && Array.isArray(uj.data)) setUsers(uj.data);
      if (!cj.success || !pj.success) setDataError('تعذر تحميل بعض البيانات');
    }).catch(() => setDataError('تعذر الاتصال بالخادم'))
      .finally(() => setDataLoading(false));
  }, []);

  /* ── Calculations (memoized — recompute only when lines/discount/tax change) ── */
  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.price) || 0), 0),
    [lines],
  );
  const discountAmt = useMemo(() => {
    const v = parseFloat(discountValue) || 0;
    if (discountType === 'percentage') return Math.min(subtotal * v / 100, subtotal);
    return Math.min(v, subtotal);
  }, [subtotal, discountValue, discountType]);
  const afterDiscount = useMemo(() => subtotal - discountAmt, [subtotal, discountAmt]);
  const taxAmt        = useMemo(() => taxEnabled ? afterDiscount * TAX_RATE : 0, [taxEnabled, afterDiscount]);
  const grandTotal    = useMemo(() => afterDiscount + taxAmt, [afterDiscount, taxAmt]);

  /* ── Line helpers (stable refs via useCallback) ── */
  const setLine = useCallback((i: number, field: keyof InvoiceLine, val: string) => {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: val };
      if (field === 'productId') {
        const p = products.find(p => p.id === val);
        if (p) {
          if (p.price != null) updated.price = String(p.price);
          if (!updated.description) updated.description = p.nameAr;
        }
      }
      return updated;
    }));
  }, [products]);

  const addLine    = useCallback(() => setLines(ls => [...ls, emptyLine()]), []);
  const removeLine = useCallback((i: number) => {
    setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls);
  }, []);

  /* ── Keyboard navigation: Enter moves to next field in the row ── */
  const handleLineKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowIdx: number,
    field: 'productId' | 'description' | 'quantity' | 'price',
  ) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const fieldOrder: (typeof field)[] = ['productId', 'description', 'quantity', 'price'];
    const nextFieldIdx = fieldOrder.indexOf(field) + 1;
    if (nextFieldIdx < fieldOrder.length) {
      const nextField = fieldOrder[nextFieldIdx];
      const el = document.querySelector<HTMLElement>(
        `[data-row="${rowIdx}"][data-field="${nextField}"]`,
      );
      el?.focus();
    } else {
      // last field in row → move to next row's product, or add a new row
      const nextRowEl = document.querySelector<HTMLElement>(
        `[data-row="${rowIdx + 1}"][data-field="productId"]`,
      );
      if (nextRowEl) {
        nextRowEl.focus();
      } else {
        setLines(ls => [...ls, emptyLine()]);
        // focus happens after re-render via queueMicrotask
        setTimeout(() => {
          const newEl = document.querySelector<HTMLElement>(
            `[data-row="${rowIdx + 1}"][data-field="productId"]`,
          );
          newEl?.focus();
        }, 50);
      }
    }
  }, []);

  /* ── Quick-add handlers ── */
  function handleCustomerCreated(c: Customer) {
    setCustomers(cs => [c, ...cs]);
    setCustomerId(c.id);
    setShowAddCustomer(false);
    showToast('تم إضافة العميل بنجاح', 'success');
  }
  function handleProductCreated(p: Product) {
    setProducts(ps => [p, ...ps]);
    if (addProductLineIdx !== null) {
      setLine(addProductLineIdx, 'productId', p.id);
    }
    setShowAddProduct(false);
    setAddProductLineIdx(null);
    showToast('تم إضافة المنتج بنجاح', 'success');
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  /* ── Validation ── */
  function validate(): string | null {
    if (!customerId) return 'يجب اختيار العميل';
    if (!invoiceDate) return 'يجب تحديد تاريخ الفاتورة';
    if (lines.every(l => !l.productId)) return 'يجب إضافة صنف واحد على الأقل';
    if (lines.some(l => l.productId && !(parseFloat(l.quantity) > 0))) return 'الكمية يجب أن تكون أكبر من صفر';
    if (grandTotal <= 0) return 'إجمالي الفاتورة يجب أن يكون أكبر من صفر';

    // Stock validation: warn if product stock might be insufficient
    for (const line of lines) {
      if (!line.productId) continue;
      const p = products.find(p => p.id === line.productId);
      const qty = parseFloat(line.quantity) || 0;
      if (p && p.stock != null && qty > p.stock) {
        return `المخزون غير كافٍ لـ "${p.nameAr}" (متاح: ${p.stock})`;
      }
    }
    return null;
  }

  /* ── Error translation ── */
  function translateError(err: string): string {
    if (!err) return 'حدث خطأ غير متوقع';
    if (err.includes('foreign key') || err.includes('Foreign key') || err.includes('P2003')) return 'هذا العنصر مرتبط ببيانات أخرى';
    if (err.includes('Unique') || err.includes('P2002')) return 'رقم الفاتورة مستخدم بالفعل';
    if (err.includes('Stock') || err.includes('stock') || err.includes('insufficient')) return 'رصيد المخزون غير كافٍ';
    if (err.includes('Validation') || err.includes('validation')) return 'بيانات غير مكتملة أو غير صحيحة';
    if (err.includes('connect') || err.includes('fetch')) return 'تعذر الاتصال بالخادم';
    return err;
  }

  /* ── Submit ── */
  // mode: 'draft' → حفظ كمسودة / 'confirm' → حفظ وإغلاق / 'new' → حفظ وجديد / 'print' → حفظ وطباعة
  const handleSubmit = useCallback(async (
    e: React.FormEvent,
    mode: 'draft' | 'confirm' | 'new' | 'print' = saveMode,
  ) => {
    e.preventDefault();
    // Skip customer validation for drafts
    if (mode !== 'draft') {
      const err = validate();
      if (err) { setFormError(err); return; }
    } else if (!lines.some(l => l.productId)) {
      setFormError('أضف صنفاً واحداً على الأقل'); return;
    }

    setSaving(true); setSaveMode(mode);
    setFormError('');

    const validLines = lines.filter(l => l.productId && parseFloat(l.quantity) > 0);
    const finalStatus = mode === 'draft' ? 'draft' : status;

    const payload = {
      customerId: customerId || undefined,
      date: invoiceDate,
      issueDate: issueDate || undefined,
      status: finalStatus,
      paymentStatus,
      salesRepId: salesRepId || undefined,
      paymentTermsDays: parseInt(paymentTermsDays, 10) || 0,
      currency: currency || 'EGP',
      template: template || 'default',
      ...(invoiceNumber.trim() && { invoiceNumber: invoiceNumber.trim() }),
      notes: notes.trim() || undefined,
      total: subtotal,
      discount: discountAmt,
      tax: taxAmt,
      grandTotal,
      items: validLines.map(l => ({
        productId:   l.productId,
        description: (l.description || '').trim() || undefined,
        quantity:    parseFloat(l.quantity) || 1,
        price:       parseFloat(l.price) || 0,
        total:       (parseFloat(l.quantity) || 1) * (parseFloat(l.price) || 0),
      })),
    };

    console.log('[SalesInvoice] Sending payload:', payload);

    try {
      const res = await fetch('/api/sales-invoices', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const j = await res.json();
      console.log('[SalesInvoice] Response:', j);

      if (j.success) {
        if (mode === 'draft') {
          showToast('تم حفظ المسودة ✓', 'success');
          setTimeout(() => router.push('/sales/invoices'), 1000);
        } else if (mode === 'new') {
          showToast('تم حفظ الفاتورة بنجاح ✓', 'success');
          setCustomerId(''); setInvoiceNumber(''); setNotes('');
          setLines([emptyLine()]); setDiscountValue(''); setTaxEnabled(false);
          setStatus('pending'); setPaymentStatus('cash');
          setInvoiceDate(new Date().toISOString().split('T')[0]);
          setIssueDate(new Date().toISOString().split('T')[0]);
          setSalesRepId(''); setPaymentTermsDays('0');
        } else if (mode === 'print') {
          showToast('تم حفظ الفاتورة جاري فتح الطباعة…', 'success');
          // Open print preview in a new tab so the form state is preserved.
          const newId = j.data?.id ?? j.data?.invoice?.id;
          if (newId) window.open(`/sales/invoices/${newId}/print`, '_blank');
          setTimeout(() => router.push('/sales/invoices'), 800);
        } else {
          showToast('تم حفظ الفاتورة بنجاح ✓', 'success');
          setTimeout(() => router.push('/sales/invoices'), 1000);
        }
      } else {
        const rawMsg = j.message || j.error || 'فشل إنشاء الفاتورة';
        setFormError(translateError(rawMsg));
      }
    } catch {
      setFormError('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveMode, customerId, invoiceDate, issueDate, salesRepId, paymentTermsDays, currency, template, lines, grandTotal, subtotal, discountAmt, taxAmt, status, paymentStatus, invoiceNumber, notes, products, router]);

  /* ── Render ── */
  if (dataLoading) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-slate-500">جاري تحميل البيانات…</div>
    </div>
  );

  return (
    <div dir="rtl" className="pb-12">
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      {showAddCustomer && <QuickAddCustomer onCreated={handleCustomerCreated} onClose={() => setShowAddCustomer(false)} />}
      {showAddProduct && (
        <QuickAddProduct
          onCreated={handleProductCreated}
          onClose={() => { setShowAddProduct(false); setAddProductLineIdx(null); }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">فاتورة مبيعات جديدة</h1>
          <p className="text-sm text-slate-500 mt-0.5">أنشئ فاتورة مبيعات جديدة للعميل</p>
        </div>
        <Link href="/sales/invoices"
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50">
          <ArrowRight className="w-4 h-4" /> العودة للقائمة
        </Link>
      </div>

      {dataError && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm p-3 rounded-lg">
          ⚠ {dataError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
          </div>
        )}

        {/* ── Invoice Details ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">بيانات الفاتورة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Customer */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">العميل *</label>
              <div className="flex gap-2">
                <select required value={customerId} onChange={e => setCustomerId(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">— اختر العميل —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddCustomer(true)} title="إضافة عميل جديد"
                  className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ *</label>
              <input type="date" required value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Invoice Number */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">رقم الفاتورة</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="يُنشأ تلقائياً"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الحالة</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="pending">معلقة</option>
                <option value="paid">مدفوعة</option>
                <option value="draft">مسودة</option>
                <option value="cancelled">ملغاة</option>
              </select>
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">طريقة الدفع</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="cash">نقداً</option>
                <option value="credit">آجل</option>
                <option value="partial">جزئي</option>
                <option value="bank_transfer">تحويل بنكي</option>
              </select>
            </div>

            {/* Issue Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ الإصدار</label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Sales Rep */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">مسؤول المبيعات</label>
              <select value={salesRepId} onChange={e => setSalesRepId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— بدون —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
            </div>

            {/* Payment Terms */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">شروط الدفع (أيام)</label>
              <input type="number" min="0" value={paymentTermsDays} onChange={e => setPaymentTermsDays(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0 = نقداً" />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">العملة</label>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="EGP">جنيه مصري (EGP)</option>
                <option value="USD">دولار (USD)</option>
                <option value="EUR">يورو (EUR)</option>
                <option value="SAR">ريال سعودي (SAR)</option>
                <option value="AED">درهم إماراتي (AED)</option>
              </select>
            </div>

            {/* Template */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">قالب الفاتورة</label>
              <select value={template} onChange={e => setTemplate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="default">التصميم الافتراضي</option>
                <option value="minimal">مبسّط</option>
                <option value="detailed">مُفصّل</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Line Items ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <h2 className="text-sm font-semibold text-slate-700">البنود</h2>
            <button type="button" onClick={addLine}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition-colors">
              <Plus className="w-3.5 h-3.5" /> إضافة صنف
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-5/12">المنتج</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-2/12">البيان</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-1/12">الكمية</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-2/12">السعر (ج.م)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-2/12">الإجمالي</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lines.every(l => !l.productId) && (
                  <tr>
                    <td colSpan={6} className="py-5 text-center">
                      <p className="text-slate-400 text-xs">لم يتم إضافة أصناف بعد — اختر منتجاً لإضافة صنف</p>
                    </td>
                  </tr>
                )}
                {lines.map((line, i) => {
                  const qty  = parseFloat(line.quantity) || 0;
                  const pr   = parseFloat(line.price) || 0;
                  const sub  = qty * pr;
                  const prod = products.find(p => p.id === line.productId);
                  const lowStock = prod && prod.stock != null && qty > prod.stock;

                  return (
                    <tr key={i} className={lowStock ? 'bg-red-50' : ''}>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <select value={line.productId} onChange={e => setLine(i, 'productId', e.target.value)}
                            onKeyDown={e => handleLineKeyDown(e as any, i, 'productId')}
                            data-row={i} data-field="productId"
                            className={`flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white ${lowStock ? 'border-red-300' : 'border-slate-200'}`}>
                            <option value="">— اختر المنتج —</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.nameAr} ({p.code})
                              </option>
                            ))}
                          </select>
                          <button type="button" title="منتج جديد"
                            onClick={() => { setAddProductLineIdx(i); setShowAddProduct(true); }}
                            className="flex-shrink-0 px-1.5 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        {prod && !lowStock && (
                          <p className="text-xs text-slate-400 mt-0.5 pr-1">
                            المخزون: {prod.stock?.toLocaleString('ar-EG') ?? '—'}
                          </p>
                        )}
                        {lowStock && <p className="text-red-500 text-xs mt-0.5">⚠ مخزون غير كافٍ (متاح: {prod!.stock})</p>}
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={line.description} onChange={e => setLine(i, 'description', e.target.value)}
                          onKeyDown={e => handleLineKeyDown(e, i, 'description')}
                          data-row={i} data-field="description"
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="وصف (اختياري)" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0.01" step="0.01" value={line.quantity}
                          onChange={e => setLine(i, 'quantity', e.target.value)}
                          onKeyDown={e => handleLineKeyDown(e, i, 'quantity')}
                          data-row={i} data-field="quantity"
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-center" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" value={line.price}
                          onChange={e => setLine(i, 'price', e.target.value)}
                          onKeyDown={e => handleLineKeyDown(e, i, 'price')}
                          data-row={i} data-field="price"
                          placeholder="0.00"
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="px-3 py-1.5 text-xs font-medium text-slate-700 whitespace-nowrap text-left">
                        {sub > 0 ? `${fmt(sub)} ج.م` : '—'}
                      </td>
                      <td className="px-1 py-1.5">
                        <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1}
                          className="text-slate-300 hover:text-red-500 disabled:opacity-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" onClick={addLine}
            className="mt-3 w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
            + إضافة صنف آخر
          </button>
        </div>

        {/* ── Discount + Tax + Notes ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: Discount + Tax */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">الخصم والضريبة</h2>

            {/* Discount */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">الخصم</label>
              <div className="flex gap-2 items-center">
                <div className="flex border border-slate-300 rounded-lg overflow-hidden text-xs">
                  <button type="button" onClick={() => setDiscountType('percentage')}
                    className={`px-3 py-2 flex items-center gap-1 font-medium transition-colors ${discountType === 'percentage' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    <Percent className="w-3 h-3" /> نسبة
                  </button>
                  <button type="button" onClick={() => setDiscountType('fixed')}
                    className={`px-3 py-2 flex items-center gap-1 font-medium transition-colors ${discountType === 'fixed' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    <DollarSign className="w-3 h-3" /> مبلغ ثابت
                  </button>
                </div>
                <input type="number" min="0" step="0.01" value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? '0%' : '0.00'}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {discountAmt > 0 && (
                <p className="text-green-600 text-xs mt-1">
                  خصم: {fmt(discountAmt)} ج.م
                  {discountType === 'percentage' && discountValue && ` (${discountValue}%)`}
                </p>
              )}
            </div>

            {/* Tax */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">ضريبة القيمة المضافة (14%)</label>
              <button type="button" onClick={() => setTaxEnabled(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  taxEnabled ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}>
                {taxEnabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {taxEnabled ? `تشمل الضريبة (+${fmt(taxAmt)} ج.م)` : 'إضافة ضريبة 14%'}
              </button>
            </div>
          </div>

          {/* Right: Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">ملاحظات</h2>
            <textarea rows={5} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="أي ملاحظات أو شروط خاصة بهذه الفاتورة…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        {/* ── Summary + Actions ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex flex-col lg:flex-row gap-6 items-start justify-between">

            {/* Totals breakdown */}
            <div className="w-full lg:w-80 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي</span>
                <span className="font-medium">{fmt(subtotal)} ج.م</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>الخصم</span>
                  <span className="font-medium">− {fmt(discountAmt)} ج.م</span>
                </div>
              )}
              {taxEnabled && (
                <div className="flex justify-between text-orange-600">
                  <span>ضريبة القيمة المضافة (14%)</span>
                  <span className="font-medium">+ {fmt(taxAmt)} ج.م</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg text-slate-900 border-t border-slate-200 pt-2 mt-2">
                <span>الإجمالي الكلي</span>
                <span className="text-blue-700">{fmt(grandTotal)} ج.م</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              {/* Save Draft */}
              <button type="button" disabled={saving}
                onClick={e => handleSubmit(e as any, 'draft')}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors border border-slate-200">
                {saving && saveMode === 'draft'
                  ? <><span className="inline-block w-3.5 h-3.5 border-2 border-slate-400/40 border-t-slate-600 rounded-full animate-spin" /> جاري الحفظ…</>
                  : '📋 حفظ مسودة'}
              </button>
              {/* Save & New */}
              <button type="button" disabled={saving}
                onClick={e => handleSubmit(e as any, 'new')}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm">
                {saving && saveMode === 'new'
                  ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري الحفظ…</>
                  : '➕ حفظ وجديد'}
              </button>
              {/* Save & Print */}
              <button type="button" disabled={saving}
                onClick={e => handleSubmit(e as any, 'print')}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
                {saving && saveMode === 'print'
                  ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري الحفظ…</>
                  : '🖨️ حفظ وطباعة'}
              </button>
              {/* Save & Close */}
              <button type="submit" disabled={saving}
                onClick={() => setSaveMode('confirm')}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
                {saving && saveMode === 'confirm'
                  ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري الحفظ…</>
                  : '✓ حفظ وإغلاق'}
              </button>
              <Link href="/sales/invoices"
                className="px-4 py-2.5 bg-white text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors text-center border border-slate-200">
                إلغاء
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
