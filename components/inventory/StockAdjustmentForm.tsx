'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Package } from 'lucide-react';
import { useToast, Toast } from '@/components/ui/patterns';
import { Field, SelectField, TextAreaField, Section, FieldGrid } from '@/components/ui/modal';
import { EntityFormPage } from '@/components/forms/EntityFormPage';
import { apiGet } from '@/lib/api/fetcher';

interface ProductLite {
  id:     string;
  code:   string;
  nameAr: string;
  stock:  number;
  unit?:  string | null;
}

const REASON_OPTIONS = [
  { value: 'damaged',     label: 'تالف' },
  { value: 'lost',        label: 'فاقد' },
  { value: 'expired',     label: 'منتهي الصلاحية' },
  { value: 'count_diff',  label: 'فارق جرد' },
  { value: 'received',    label: 'استلام بدون فاتورة' },
  { value: 'returned',    label: 'مردود داخلي' },
  { value: 'other',       label: 'أخرى' },
];

export function StockAdjustmentForm() {
  const router = useRouter();
  const [toast, showToast] = useToast();

  const productsQ = useQuery({
    queryKey: ['products', 'lite'],
    queryFn:  () => apiGet<ProductLite[]>('/api/products'),
    staleTime: 60_000,
  });
  const products   = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p] as const)), [products]);

  const [form, setForm] = useState({
    productId: '',
    type:      'decrease' as 'increase' | 'decrease',
    quantity:  '',
    reason:    'damaged',
    date:      new Date().toISOString().slice(0, 10),
    notes:     '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const selectedProduct = form.productId ? productMap.get(form.productId) : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.productId) return setError('يجب اختيار المنتج');
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) return setError('الكمية يجب أن تكون أكبر من صفر');
    if (!form.reason) return setError('يجب اختيار السبب');

    setSaving(true);
    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          type:      form.type,
          quantity:  qty,
          reason:    form.reason,
          date:      form.date,
          notes:     form.notes.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (j.success) {
        showToast('تم تسجيل التسوية', 'success');
        setTimeout(() => router.push('/inventory/stock-adjustments'), 600);
      } else {
        setError(j.message || j.error || 'فشل الحفظ');
        setSaving(false);
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
      setSaving(false);
    }
  }

  return (
    <>
      <Toast toast={toast} />
      <EntityFormPage
        title="تسوية مخزون جديدة"
        subtitle="عدّل رصيد المنتج بسبب تالف، فاقد، فارق جرد، أو غيرها"
        backHref="/inventory/stock-adjustments"
        icon={<ClipboardList className="w-5 h-5" />}
        error={error}
        saving={saving}
        formId="adjustment-form"
        primaryLabel="حفظ التسوية"
      >
        <form id="adjustment-form" onSubmit={handleSubmit} className="space-y-5">
          <Section title="المنتج" subtitle="اختر المنتج المراد تسويته">
            <FieldGrid>
              <SelectField
                label="المنتج"
                required
                value={form.productId}
                onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                className="sm:col-span-2"
              >
                <option value="">— اختر المنتج —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} ({p.code}) — رصيد حالي {p.stock.toLocaleString('ar-EG')}
                  </option>
                ))}
              </SelectField>

              {selectedProduct && (
                <div className="sm:col-span-2 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl p-3 text-xs flex items-center gap-2">
                  <Package className="w-4 h-4 flex-shrink-0" />
                  <span>
                    الرصيد الحالي:{' '}
                    <strong className="tabular-nums">
                      {selectedProduct.stock.toLocaleString('ar-EG')}
                    </strong>{' '}
                    {selectedProduct.unit || ''}
                  </span>
                </div>
              )}
            </FieldGrid>
          </Section>

          <Section title="بيانات التسوية" subtitle="نوع التسوية، الكمية، والسبب">
            <FieldGrid>
              <SelectField
                label="نوع التسوية"
                required
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'increase' | 'decrease' }))}
              >
                <option value="decrease">خصم من المخزون (تالف / فاقد …)</option>
                <option value="increase">إضافة للمخزون (استلام / مردود …)</option>
              </SelectField>

              <Field
                label="الكمية"
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />

              <SelectField
                label="السبب"
                required
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              >
                {REASON_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </SelectField>

              <Field
                label="التاريخ"
                required
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />

              <TextAreaField
                label="ملاحظات"
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="أي ملاحظات إضافية…"
                className="sm:col-span-2"
              />
            </FieldGrid>
          </Section>
        </form>
      </EntityFormPage>
    </>
  );
}
