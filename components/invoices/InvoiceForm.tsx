'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Trash2, ArrowRight, AlertCircle, CheckCircle, Printer, UserPlus,
} from 'lucide-react';
import { Toast, useToast } from '@/components/ui/patterns';
import { InvoiceConfig, fmtMoney } from './InvoiceConfig';
import { InvoiceLayout } from './InvoiceLayout';
import { QuickAddPartyModal, type CreatedParty } from './QuickAddPartyModal';

/* ─── Types ──────────────────────────────────────────────────────── */
interface PartyOption  { id: string; nameAr: string; phone?: string | null; }
interface ProductOption {
  id: string; nameAr: string; code: string;
  price?: number; cost?: number; stock?: number;
}
interface UserOption   { id: string; name?: string | null; email: string; }

interface InvoiceLine {
  productId: string;
  description: string;
  quantity: string;
  price: string;
}

interface ExistingInvoice {
  id: string;
  invoiceNumber?: string;
  customerId?: string;
  supplierId?: string;
  date?: string;
  issueDate?: string | null;
  status?: string;
  paymentStatus?: string;
  notes?: string | null;
  salesRepId?: string | null;
  purchaseRepId?: string | null;
  paymentTermsDays?: number | null;
  currency?: string | null;
  template?: string | null;
  discount?: number;
  total?: number;
  items?: Array<{
    productId: string;
    description?: string | null;
    quantity: number;
    price: number;
  }>;
}

const emptyLine = (): InvoiceLine => ({ productId: '', description: '', quantity: '1', price: '' });

/* ─── Main form ──────────────────────────────────────────────────── */
export function InvoiceForm({
  config,
  existing,
  mode = 'create',
}: {
  config: InvoiceConfig;
  existing?: ExistingInvoice;
  mode?: 'create' | 'edit';
}) {
  const router = useRouter();
  const [toast, showToast] = useToast();

  /* ── Reference data ── */
  const [parties,  setParties]  = useState<PartyOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [users,    setUsers]    = useState<UserOption[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  /* ── Form state ── */
  const [partyId, setPartyId]           = useState(existing?.[config.partyIdField] ?? '');
  const [invoiceNumber, setInvoiceNumber] = useState(existing?.invoiceNumber ?? '');
  const [invoiceDate,   setInvoiceDate]   = useState(
    existing?.date ? existing.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [issueDate,     setIssueDate]     = useState(
    existing?.issueDate ? String(existing.issueDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
  );
  const [status,        setStatus]        = useState(existing?.status ?? 'pending');
  const [paymentStatus, setPaymentStatus] = useState(existing?.paymentStatus ?? 'cash');
  const [notes,         setNotes]         = useState(existing?.notes ?? '');
  const [repId,         setRepId]         = useState(
    (config.kind === 'sales' ? existing?.salesRepId : existing?.purchaseRepId) ?? '',
  );
  const [paymentTermsDays, setPaymentTermsDays] = useState(String(existing?.paymentTermsDays ?? 0));
  const [currency, setCurrency] = useState(existing?.currency ?? 'EGP');
  const [template, setTemplate] = useState(existing?.template ?? 'default');
  const [lines, setLines] = useState<InvoiceLine[]>(
    existing?.items?.length
      ? existing.items.map(it => ({
          productId: it.productId,
          description: it.description ?? '',
          quantity: String(it.quantity),
          price: String(it.price),
        }))
      : [emptyLine()],
  );

  /* ── UI state ── */
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<'draft' | 'confirm' | 'new' | 'print'>('confirm');
  const [formError, setFormError] = useState('');
  const [showAddParty, setShowAddParty] = useState(false);

  /* ── Load reference data ── */
  useEffect(() => {
    Promise.all([
      fetch(config.partyApi, { credentials: 'include' }).then(r => r.json()),
      fetch('/api/products',  { credentials: 'include' }).then(r => r.json()),
      fetch('/api/users',     { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false })),
    ]).then(([pj, prj, uj]) => {
      if (pj.success)  setParties(pj.data ?? []);
      if (prj.success) setProducts(prj.data ?? []);
      if (uj?.success && Array.isArray(uj.data)) setUsers(uj.data);
    }).finally(() => setDataLoading(false));
  }, [config.partyApi]);

  /* ── Calculations ── */
  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.price) || 0), 0),
    [lines],
  );
  const grandTotal = subtotal; // simple form — discount/tax can be added per-line if needed

  /* ── Line helpers ── */
  const setLine = useCallback((i: number, field: keyof InvoiceLine, val: string) => {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: val };
      if (field === 'productId') {
        const p = products.find(x => x.id === val);
        if (p) {
          // For sales we default to product price; for purchases we default to cost.
          const def = config.kind === 'sales' ? p.price : (p.cost ?? p.price);
          if (def != null && !updated.price) updated.price = String(def);
          if (!updated.description) updated.description = p.nameAr;
        }
      }
      return updated;
    }));
  }, [products, config.kind]);

  const addLine    = useCallback(() => setLines(ls => [...ls, emptyLine()]), []);
  const removeLine = useCallback((i: number) => {
    setLines(ls => ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls);
  }, []);

  /* ── Validation ── */
  function validate(allowEmptyParty = false): string | null {
    if (!allowEmptyParty && !partyId) return `يجب اختيار ${config.partyLabel}`;
    if (!invoiceDate) return 'يجب تحديد تاريخ الفاتورة';
    if (lines.every(l => !l.productId)) return 'يجب إضافة صنف واحد على الأقل';
    if (lines.some(l => l.productId && !(parseFloat(l.quantity) > 0))) {
      return 'الكمية يجب أن تكون أكبر من صفر';
    }
    if (grandTotal <= 0) return 'إجمالي الفاتورة يجب أن يكون أكبر من صفر';
    // Stock validation only meaningful for sales
    if (config.kind === 'sales') {
      for (const line of lines) {
        if (!line.productId) continue;
        const p = products.find(x => x.id === line.productId);
        const qty = parseFloat(line.quantity) || 0;
        if (p && p.stock != null && qty > p.stock) {
          return `المخزون غير كافٍ لـ "${p.nameAr}" (متاح: ${p.stock})`;
        }
      }
    }
    return null;
  }

  /* ── Submit ── */
  const handleSubmit = useCallback(async (
    e: React.FormEvent,
    submitMode: 'draft' | 'confirm' | 'new' | 'print' = saveMode,
  ) => {
    e.preventDefault();
    setSaveMode(submitMode);
    setFormError('');

    if (submitMode !== 'draft') {
      const err = validate();
      if (err) { setFormError(err); return; }
    } else if (!lines.some(l => l.productId)) {
      setFormError('أضف صنفاً واحداً على الأقل لحفظ المسودة');
      return;
    }

    setSaving(true);
    const validLines = lines.filter(l => l.productId && parseFloat(l.quantity) > 0);
    const finalStatus = submitMode === 'draft' ? 'draft' : status;

    const payload: Record<string, unknown> = {
      [config.partyIdField]: partyId || undefined,
      date: invoiceDate,
      issueDate: issueDate || undefined,
      status: finalStatus,
      paymentStatus,
      [config.repIdField]: repId || undefined,
      paymentTermsDays: parseInt(paymentTermsDays, 10) || 0,
      currency: currency || 'EGP',
      template: template || 'default',
      ...(invoiceNumber.trim() && { invoiceNumber: invoiceNumber.trim() }),
      notes: notes.trim() || undefined,
      total: subtotal,
      grandTotal,
      items: validLines.map(l => ({
        productId:   l.productId,
        description: (l.description || '').trim() || undefined,
        quantity:    parseFloat(l.quantity) || 1,
        price:       parseFloat(l.price) || 0,
        total:       (parseFloat(l.quantity) || 1) * (parseFloat(l.price) || 0),
      })),
    };

    try {
      const url = mode === 'edit' && existing
        ? `${config.listApi}?id=${encodeURIComponent(existing.id)}`
        : config.listApi;
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();

      if (j.success) {
        const newId = j.data?.id ?? j.data?.invoice?.id ?? existing?.id;
        if (submitMode === 'draft') {
          showToast('تم حفظ المسودة', 'success');
          setTimeout(() => router.push(`/invoices/${config.routeBase}`), 800);
        } else if (submitMode === 'new') {
          showToast('تم حفظ الفاتورة بنجاح', 'success');
          // Reset for a new invoice
          setPartyId(''); setInvoiceNumber(''); setNotes('');
          setLines([emptyLine()]); setStatus('pending'); setPaymentStatus('cash');
          setInvoiceDate(new Date().toISOString().slice(0, 10));
          setIssueDate(new Date().toISOString().slice(0, 10));
          setRepId(''); setPaymentTermsDays('0');
        } else if (submitMode === 'print') {
          showToast('تم الحفظ، جاري فتح الطباعة…', 'success');
          if (newId) window.open(`/invoices/${config.routeBase}/${newId}/print`, '_blank');
          setTimeout(() => router.push(`/invoices/${config.routeBase}`), 800);
        } else {
          showToast(mode === 'edit' ? 'تم تحديث الفاتورة' : 'تم حفظ الفاتورة بنجاح', 'success');
          setTimeout(() => router.push(`/invoices/${config.routeBase}`), 800);
        }
      } else {
        setFormError(translateError(j.message || j.error || 'فشل الحفظ'));
      }
    } catch {
      setFormError('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  // `validate` is recreated on every render but reads the same closed-over
  // state we already list below — explicitly suppress the missing-dep lint.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    saveMode, partyId, invoiceDate, issueDate, status, paymentStatus, repId,
    paymentTermsDays, currency, template, invoiceNumber, notes, subtotal,
    grandTotal, lines, config, mode, existing, router, showToast, products,
  ]);

  /* ── Render ── */
  if (dataLoading) {
    return (
      <InvoiceLayout title={mode === 'edit' ? `تعديل ${config.titleSingular}` : `${config.titleSingular} جديدة`}>
        <div className="flex items-center justify-center h-64 text-slate-500">جاري التحميل…</div>
      </InvoiceLayout>
    );
  }

  return (
    <InvoiceLayout
      title={mode === 'edit' ? `تعديل ${config.titleSingular}` : `${config.titleSingular} جديدة`}
      subtitle={mode === 'edit' ? `تعديل بيانات الفاتورة` : `أنشئ فاتورة جديدة لـ${config.partyLabel}`}
      toolbar={
        <Link href={`/invoices/${config.routeBase}`}
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">
          <ArrowRight className="w-4 h-4" /> العودة للقائمة
        </Link>
      }
    >
      <Toast toast={toast} />

      <QuickAddPartyModal
        config={config}
        open={showAddParty}
        onClose={() => setShowAddParty(false)}
        onCreated={(p: CreatedParty) => {
          // Prepend to options + auto-select.
          setParties(prev => [{ id: p.id, nameAr: p.nameAr, phone: p.phone ?? null }, ...prev]);
          setPartyId(p.id);
          showToast(`تمت إضافة ${p.nameAr}`, 'success');
        }}
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
          </div>
        )}

        {/* Invoice Details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">
            بيانات الفاتورة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <Label>{config.partyLabel} *</Label>
              <div className="flex gap-2">
                <select required value={partyId} onChange={e => setPartyId(e.target.value)}
                  className={`${inputCls} flex-1`}>
                  <option value="">— اختر {config.partyLabel} —</option>
                  {parties.map(p => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddParty(true)}
                  title={config.addPartyLabel}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors flex-shrink-0">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{config.addPartyLabel}</span>
                </button>
              </div>
            </div>
            <div>
              <Label>التاريخ *</Label>
              <input type="date" required value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <Label>رقم الفاتورة</Label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                placeholder={`${config.numberPrefix}-… (اختياري)`} className={inputCls} />
            </div>
            <div>
              <Label>الحالة</Label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                <option value="pending">معلقة</option>
                <option value="paid">مدفوعة</option>
                <option value="draft">مسودة</option>
                <option value="cancelled">ملغاة</option>
              </select>
            </div>
            <div>
              <Label>طريقة الدفع</Label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className={inputCls}>
                <option value="cash">نقداً</option>
                <option value="credit">آجل</option>
                <option value="partial">جزئي</option>
                <option value="bank_transfer">تحويل بنكي</option>
              </select>
            </div>
            <div>
              <Label>تاريخ الإصدار</Label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <Label>{config.kind === 'sales' ? 'مسؤول المبيعات' : 'مسؤول المشتريات'}</Label>
              <select value={repId} onChange={e => setRepId(e.target.value)} className={inputCls}>
                <option value="">— بدون —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
            </div>
            <div>
              <Label>شروط الدفع (أيام)</Label>
              <input type="number" min="0" value={paymentTermsDays}
                onChange={e => setPaymentTermsDays(e.target.value)}
                placeholder="0 = نقداً" className={inputCls} />
            </div>
            <div>
              <Label>العملة</Label>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
                <option value="EGP">جنيه مصري</option>
                <option value="USD">دولار</option>
                <option value="EUR">يورو</option>
                <option value="SAR">ريال سعودي</option>
                <option value="AED">درهم إماراتي</option>
              </select>
            </div>
            <div>
              <Label>قالب الفاتورة</Label>
              <select value={template} onChange={e => setTemplate(e.target.value)} className={inputCls}>
                <option value="default">الافتراضي</option>
                <option value="minimal">مبسّط</option>
                <option value="detailed">مُفصّل</option>
              </select>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
            <h2 className="text-sm font-semibold text-slate-700">البنود</h2>
            <button type="button" onClick={addLine}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50">
              <Plus className="w-3.5 h-3.5" /> إضافة صنف
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-[35%]">المنتج</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-[20%]">البيان</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-[10%]">الكمية</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-[15%]">السعر</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-[15%]">الإجمالي</th>
                  <th className="w-[5%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lines.map((line, i) => {
                  const qty = parseFloat(line.quantity) || 0;
                  const pr  = parseFloat(line.price) || 0;
                  const sub = qty * pr;
                  const prod = products.find(p => p.id === line.productId);
                  const lowStock = config.kind === 'sales' && prod && prod.stock != null && qty > prod.stock;
                  return (
                    <tr key={i} className={lowStock ? 'bg-red-50' : ''}>
                      <td className="px-2 py-1.5">
                        <select value={line.productId} onChange={e => setLine(i, 'productId', e.target.value)}
                          className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white ${lowStock ? 'border-red-300' : 'border-slate-200'}`}>
                          <option value="">— اختر المنتج —</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.nameAr} ({p.code})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={line.description} onChange={e => setLine(i, 'description', e.target.value)}
                          placeholder="ملاحظة" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" value={line.quantity}
                          onChange={e => setLine(i, 'quantity', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.01" value={line.price}
                          onChange={e => setLine(i, 'price', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </td>
                      <td className="px-2 py-1.5 text-center font-semibold text-slate-700 tabular-nums">
                        {fmtMoney(sub)}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button type="button" onClick={() => removeLine(i)}
                          disabled={lines.length === 1}
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes + Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <Label>ملاحظات</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="أي ملاحظات إضافية على الفاتورة…" rows={4}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-100 pb-2">
              ملخص الفاتورة
            </h3>
            <div className="space-y-2 text-sm">
              <Row label="المجموع الفرعي" value={fmtMoney(subtotal)} />
              <Row label="الإجمالي" value={fmtMoney(grandTotal)} bold />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col sm:flex-row gap-2 justify-end">
          {mode === 'create' && (
            <button type="button" disabled={saving}
              onClick={e => handleSubmit(e as React.FormEvent, 'draft')}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 flex items-center gap-2">
              {saving && saveMode === 'draft'
                ? <Spinner /> : '📋 حفظ مسودة'}
            </button>
          )}
          {mode === 'create' && (
            <button type="button" disabled={saving}
              onClick={e => handleSubmit(e as React.FormEvent, 'new')}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {saving && saveMode === 'new' ? <Spinner /> : (<><Plus className="w-4 h-4" /> حفظ وجديد</>)}
            </button>
          )}
          {mode === 'create' && (
            <button type="button" disabled={saving}
              onClick={e => handleSubmit(e as React.FormEvent, 'print')}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {saving && saveMode === 'print' ? <Spinner /> : (<><Printer className="w-4 h-4" /> حفظ وطباعة</>)}
            </button>
          )}
          <button type="submit" disabled={saving}
            onClick={() => setSaveMode('confirm')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && saveMode === 'confirm' ? <Spinner /> : (<><CheckCircle className="w-4 h-4" /> {mode === 'edit' ? 'حفظ التغييرات' : 'حفظ وإغلاق'}</>)}
          </button>
          <Link href={`/invoices/${config.routeBase}`}
            className="px-4 py-2.5 bg-white text-slate-500 rounded-lg text-sm font-medium hover:bg-slate-50 text-center border border-slate-200">
            إلغاء
          </Link>
        </div>
      </form>
    </InvoiceLayout>
  );
}

/* ─── Helpers ─── */
const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700 mb-1">{children}</label>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t border-slate-200 pt-2 mt-1 font-bold text-slate-900 text-base' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Spinner() {
  return <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />;
}

function translateError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('p2003') || r.includes('foreign key')) return 'هذا العنصر مرتبط ببيانات أخرى';
  if (r.includes('p2002') || r.includes('unique')) return 'رقم الفاتورة مستخدم بالفعل';
  if (r.includes('stock') || r.includes('insufficient')) return 'رصيد المخزون غير كافٍ';
  if (r.includes('connect') || r.includes('fetch')) return 'تعذر الاتصال بالخادم';
  return raw;
}
