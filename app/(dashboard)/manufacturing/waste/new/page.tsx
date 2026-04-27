'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Package } from 'lucide-react';
import { apiGet } from '@/lib/api/fetcher';
import { Toast, useToast } from '@/components/ui/patterns';
import { Field, SelectField, TextAreaField, Section, FieldGrid } from '@/components/ui/modal';
import { EntityFormPage } from '@/components/forms/EntityFormPage';

interface ProductLite { id: string; code: string; nameAr: string; stock: number; unit?: string | null }
interface OrderLite   { id: string; orderNumber: string; productId: string }

export default function NewWastePage() {
  const router = useRouter();
  const [toast, showToast] = useToast();

  const productsQ = useQuery({
    queryKey: ['products', 'lite'],
    queryFn:  () => apiGet<ProductLite[]>('/api/products'),
    staleTime: 60_000,
  });
  const ordersQ = useQuery({
    queryKey: ['production-orders'],
    queryFn:  () => apiGet<OrderLite[]>('/api/production-orders'),
    staleTime: 60_000,
  });
  const products = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const orders   = useMemo(() => ordersQ.data   ?? [], [ordersQ.data]);
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p] as const)), [products]);

  const [form, setForm] = useState({
    productId:         '',
    quantity:          '',
    date:              new Date().toISOString().slice(0, 10),
    productionOrderId: '',
    notes:             '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const selectedProduct = form.productId ? productMap.get(form.productId) : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.productId)            return setError('يجب اختيار المنتج');
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0)           return setError('الكمية يجب أن تكون أكبر من صفر');

    setSaving(true);
    try {
      const res = await fetch('/api/production-waste', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId:         form.productId,
          quantity:          qty,
          date:              form.date,
          productionOrderId: form.productionOrderId || undefined,
          notes:             form.notes.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (j.success) {
        showToast('تم تسجيل الفاقد', 'success');
        setTimeout(() => router.push('/manufacturing/waste'), 600);
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
        title="تسجيل فاقد جديد"
        subtitle="سيتم خصم الكمية من المخزون فوراً"
        backHref="/manufacturing/waste"
        icon={<AlertTriangle className="w-5 h-5" />}
        error={error}
        saving={saving}
        formId="waste-form"
        primaryLabel="حفظ"
      >
        <form id="waste-form" onSubmit={handleSubmit} className="space-y-5">
          <Section title="بيانات الفاقد">
            <FieldGrid>
              <SelectField label="المنتج" required value={form.productId}
                onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                className="sm:col-span-2"
              >
                <option value="">— اختر المنتج —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} ({p.code}) — رصيد {p.stock.toLocaleString('ar-EG')}
                  </option>
                ))}
              </SelectField>

              {selectedProduct && (
                <div className="sm:col-span-2 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl p-3 text-xs flex items-center gap-2">
                  <Package className="w-4 h-4 flex-shrink-0" />
                  <span>
                    الرصيد الحالي:{' '}
                    <strong className="tabular-nums">{selectedProduct.stock.toLocaleString('ar-EG')}</strong>{' '}
                    {selectedProduct.unit || ''}
                  </span>
                </div>
              )}

              <Field label="الكمية الفاقدة" required type="number" min="0.01" step="0.01"
                value={form.quantity} placeholder="0"
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              <Field label="التاريخ" required type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />

              <SelectField label="أمر الإنتاج (اختياري)" value={form.productionOrderId}
                onChange={e => setForm(f => ({ ...f, productionOrderId: e.target.value }))}
                className="sm:col-span-2"
              >
                <option value="">— بدون —</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>{o.orderNumber}</option>
                ))}
              </SelectField>

              <TextAreaField label="الملاحظات" rows={3} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="سبب الفاقد، ظروف الحدوث…"
                className="sm:col-span-2" />
            </FieldGrid>
          </Section>
        </form>
      </EntityFormPage>
    </>
  );
}
