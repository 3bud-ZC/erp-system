'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormSkeleton, ErrorBanner } from '@/components/ui/patterns';
import { InventoryLayout } from '@/components/inventory/InventoryLayout';

interface Product { id: string; nameAr: string; code: string; stock?: number; }

const reasonOptions = [
  'فرق جرد',
  'تلف أو هالك',
  'إرجاع من عميل',
  'تحويل بين المستودعات',
  'تصحيح خطأ',
  'أخرى',
];

export default function NewStockAdjustmentPage() {
  const router = useRouter();

  const [products, setProducts]     = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError]   = useState<string | null>(null);

  const [productId, setProductId]   = useState('');
  const [type, setType]             = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity]     = useState('');
  const [reason, setReason]         = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes]           = useState('');
  const [adjDate, setAdjDate]       = useState(new Date().toISOString().split('T')[0]);

  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  /* ── Load products ────────────────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/products', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) setProducts(j.data ?? []);
        else setDataError(j.message || 'فشل تحميل المنتجات');
      })
      .catch(() => setDataError('تعذر الاتصال بالخادم'))
      .finally(() => setLoadingData(false));
  }, []);

  /* ── Submit ───────────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) { setFormError('يجب اختيار المنتج'); return; }
    const qty = parseFloat(quantity);
    if (!(qty > 0)) { setFormError('الكمية يجب أن تكون أكبر من صفر'); return; }
    const finalReason = reason === 'أخرى' ? customReason.trim() : reason;
    if (!finalReason) { setFormError('يجب إدخال سبب التسوية'); return; }

    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          type,
          quantity: qty,
          reason: finalReason,
          notes: notes.trim() || undefined,
          date: adjDate,
        }),
      });

      const j = await res.json();
      if (j.success) {
        router.push('/inventory/products');
      } else {
        setFormError(j.message || j.error || 'فشل إنشاء التسوية');
      }
    } catch {
      setFormError('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  const selectedProduct = products.find(p => p.id === productId);

  return (
    <InventoryLayout
      title="تسوية مخزون جديدة"
      subtitle="سجل زيادة أو نقص في كميات المخزون"
    >
      {dataError && (
        <div className="max-w-xl mb-4">
          <ErrorBanner message={dataError} onRetry={() => window.location.reload()} />
        </div>
      )}

      {loadingData ? (
        <div className="max-w-xl"><FormSkeleton rows={6} /></div>
      ) : (
      <form onSubmit={handleSubmit} className="max-w-xl">
        {formError && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg mb-4">
            {formError}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">

          {/* Product */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المنتج *</label>
            <select
              required
              value={productId}
              onChange={e => setProductId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— اختر المنتج —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nameAr} ({p.code}){p.stock != null ? ` — مخزون: ${p.stock}` : ''}
                </option>
              ))}
            </select>
            {selectedProduct?.stock != null && (
              <p className="text-xs text-slate-500 mt-1">
                المخزون الحالي: <span className="font-semibold text-slate-700">{selectedProduct.stock}</span>
              </p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">نوع التسوية *</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType('increase')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === 'increase'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                زيادة المخزون
              </button>
              <button
                type="button"
                onClick={() => setType('decrease')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === 'decrease'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                نقص المخزون
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الكمية *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="0"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ *</label>
            <input
              type="date"
              required
              value={adjDate}
              onChange={e => setAdjDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">سبب التسوية *</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            >
              <option value="">— اختر السبب —</option>
              {reasonOptions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === 'أخرى' && (
              <input
                type="text"
                required
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="اكتب السبب…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية (اختياري)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
            >
              {saving ? 'جاري الحفظ…' : 'حفظ التسوية'}
            </button>
            <Link
              href="/inventory/products"
              className="flex-1 text-center bg-slate-100 text-slate-700 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              إلغاء
            </Link>
          </div>
        </div>
      </form>
      )}
    </InventoryLayout>
  );
}
