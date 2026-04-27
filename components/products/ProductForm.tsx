'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Package, AlertTriangle } from 'lucide-react';
import { useToast, Toast } from '@/components/ui/patterns';
import { Field, SelectField, Section, FieldGrid } from '@/components/ui/modal';
import { EntityFormPage } from '@/components/forms/EntityFormPage';
import { apiGet } from '@/lib/api/fetcher';

export interface ProductExisting {
  id:           string;
  code:         string;
  nameAr:       string;
  nameEn?:      string | null;
  type?:        string | null;
  unit?:        string | null;
  stock:        number;
  minStock?:    number | null;
  cost:         number;
  price:        number;
  warehouseId?: string | null;
}

interface WarehouseLite {
  id:     string;
  code?:  string;
  nameAr: string;
  isActive?: boolean;
}

const empty = {
  code:        '',
  nameAr:      '',
  nameEn:      '',
  type:        'finished_product',
  unit:        'قطعة',
  price:       '',
  cost:        '',
  stock:       '0',
  minStock:    '',
  warehouseId: '',
};

export function ProductForm({
  mode,
  existing,
}: {
  mode:      'create' | 'edit';
  existing?: ProductExisting;
}) {
  const router = useRouter();
  const [toast, showToast] = useToast();

  const [form, setForm] = useState(() =>
    existing
      ? {
          code:        existing.code,
          nameAr:      existing.nameAr,
          nameEn:      existing.nameEn ?? '',
          type:        existing.type    ?? 'finished_product',
          unit:        existing.unit    ?? 'قطعة',
          price:       existing.price != null ? String(existing.price) : '',
          cost:        existing.cost  != null ? String(existing.cost)  : '',
          stock:       String(existing.stock ?? 0),
          minStock:    existing.minStock != null ? String(existing.minStock) : '',
          warehouseId: existing.warehouseId ?? '',
        }
      : empty,
  );

  // Pull active warehouses for the picker. Same shape returned across the app.
  const warehousesQ = useQuery({
    queryKey: ['warehouses'],
    queryFn:  () => apiGet<WarehouseLite[]>('/api/warehouses'),
    staleTime: 60_000,
  });
  const warehouses = (warehousesQ.data ?? []).filter(w => w.isActive !== false);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.code.trim())   return setError('الرمز مطلوب');
    if (!form.nameAr.trim()) return setError('الاسم بالعربية مطلوب');
    if (!form.price)         return setError('سعر البيع مطلوب');

    setSaving(true);
    try {
      const payload =
        mode === 'create'
          ? {
              code:   form.code.trim(),
              nameAr: form.nameAr.trim(),
              ...(form.nameEn && { nameEn: form.nameEn.trim() }),
              type:   form.type,
              unit:   form.unit || 'قطعة',
              price:  Number(form.price) || 0,
              cost:   Number(form.cost)  || 0,
              stock:  Number(form.stock) || 0,
              ...(form.minStock && { minStock: Number(form.minStock) }),
              ...(form.warehouseId && { warehouseId: form.warehouseId }),
            }
          : {
              id:          existing!.id,
              code:        form.code.trim(),
              nameAr:      form.nameAr.trim(),
              nameEn:      form.nameEn.trim() || null,
              type:        form.type,
              unit:        form.unit || 'قطعة',
              price:       Number(form.price) || 0,
              cost:        Number(form.cost)  || 0,
              minStock:    form.minStock ? Number(form.minStock) : null,
              warehouseId: form.warehouseId || null,
            };

      const res = await fetch('/api/products', {
        method:      mode === 'create' ? 'POST' : 'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
      });
      const j = await res.json();

      if (j.success) {
        showToast(mode === 'create' ? 'تم إضافة المنتج بنجاح' : 'تم تحديث بيانات المنتج', 'success');
        setTimeout(() => router.push('/inventory/products'), 600);
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
        title={mode === 'create' ? 'إنشاء منتج جديد' : 'تعديل بيانات المنتج'}
        subtitle={
          mode === 'create'
            ? 'أدخل بيانات المنتج في الأقسام التالية'
            : existing?.nameAr
        }
        backHref="/inventory/products"
        icon={<Package className="w-5 h-5" />}
        error={error}
        saving={saving}
        formId="product-form"
        primaryLabel={mode === 'create' ? 'حفظ المنتج' : 'حفظ التعديلات'}
      >
        <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
          {mode === 'edit' && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ملاحظة: لا يمكن تعديل المخزون مباشرة — استخدم فاتورة مشتريات/مبيعات أو تسوية مخزون.
            </div>
          )}

          <Section title="البيانات الأساسية" subtitle="الرمز والاسم والنوع">
            <FieldGrid>
              <Field label="الرمز" required value={form.code} placeholder="PRD-001"
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              <SelectField label="النوع" value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="finished_product">منتج نهائي</option>
                <option value="raw_material">مواد خام</option>
              </SelectField>
              <Field label="الاسم بالعربية" required value={form.nameAr} placeholder="اسم المنتج"
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} />
              <Field label="الاسم بالإنجليزية" value={form.nameEn} placeholder="Product Name (اختياري)"
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
            </FieldGrid>
          </Section>

          <Section title="التسعير ووحدة القياس" subtitle="سعر البيع، التكلفة، ووحدة القياس">
            <FieldGrid cols={3}>
              <Field label="سعر البيع (ج.م)" required type="number" min="0" step="0.01" value={form.price} placeholder="0"
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              <Field label="التكلفة (ج.م)" type="number" min="0" step="0.01" value={form.cost} placeholder="0"
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
              <Field label="وحدة القياس" value={form.unit} placeholder="قطعة"
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </FieldGrid>
          </Section>

          <Section title="إعدادات المخزون" subtitle="المستودع الافتراضي للمنتج والحد الأدنى للمخزون">
            <FieldGrid>
              <SelectField label="المستودع" value={form.warehouseId}
                onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))}>
                <option value="">بدون مستودع محدد</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.nameAr}{w.code ? ` (${w.code})` : ''}
                  </option>
                ))}
              </SelectField>
              <Field label="الحد الأدنى للمخزون" type="number" min="0" value={form.minStock} placeholder="0"
                onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} />
            </FieldGrid>
          </Section>

          {mode === 'create' && (
            <Section title="رصيد الافتتاح" subtitle="المخزون الابتدائي عند إنشاء المنتج">
              <FieldGrid>
                <Field label="المخزون الابتدائي" type="number" min="0" value={form.stock} placeholder="0"
                  className="sm:col-span-2"
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
              </FieldGrid>
            </Section>
          )}
        </form>
      </EntityFormPage>
    </>
  );
}
