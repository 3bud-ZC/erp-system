'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Layers, AlertTriangle } from 'lucide-react';
import { useToast, Toast } from '@/components/ui/patterns';
import { Field, SelectField, TextAreaField, Section, FieldGrid } from '@/components/ui/modal';
import { EntityFormPage } from '@/components/forms/EntityFormPage';
import { apiGet } from '@/lib/api/fetcher';

interface ProductLite {
  id:     string;
  code:   string;
  nameAr: string;
  type?:  string | null;
  stock:  number;
  unit?:  string | null;
}
interface BOMItemEntry {
  id:         string;
  productId:  string;
  materialId: string;
  quantity:   number;
  material:   { id: string; nameAr: string; code: string; unit?: string | null; stock: number };
}
interface ProductionLineEntry {
  id:     string;
  name:   string;
  status: string;
}

export function ProductionOrderForm() {
  const router = useRouter();
  const [toast, showToast] = useToast();

  const productsQ = useQuery({
    queryKey: ['products', 'lite'],
    queryFn:  () => apiGet<ProductLite[]>('/api/products'),
    staleTime: 60_000,
  });
  const linesQ = useQuery({
    queryKey: ['production-lines'],
    queryFn:  () => apiGet<ProductionLineEntry[]>('/api/production-lines'),
    staleTime: 60_000,
  });
  const products = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const lines    = useMemo(() => linesQ.data    ?? [], [linesQ.data]);

  // Only finished products are valid manufacturing targets.
  const finishedProducts = useMemo(
    () => products.filter(p => (p.type ?? 'finished_product') === 'finished_product'),
    [products],
  );

  const [form, setForm] = useState({
    productId:        '',
    productionLineId: '',
    quantity:         '',
    laborCost:        '0',
    overheadCost:     '0',
    date:             new Date().toISOString().slice(0, 10),
    notes:            '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  /* Pull BOM for the selected finished product so we can show the materials
   * required + warn the user if any raw stock won't cover the order. */
  const bomQ = useQuery({
    queryKey: ['bom', form.productId],
    queryFn:  () => apiGet<BOMItemEntry[]>(`/api/bom?productId=${form.productId}`),
    enabled:  !!form.productId,
  });
  const bom = useMemo(() => bomQ.data ?? [], [bomQ.data]);

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p] as const)), [products]);

  const requirements = useMemo(() => {
    const qty = parseFloat(form.quantity) || 0;
    return bom.map(b => {
      const required  = b.quantity * qty;
      const available = productMap.get(b.materialId)?.stock ?? b.material.stock ?? 0;
      const shortage  = required - available;
      return {
        materialId: b.materialId,
        nameAr:     b.material.nameAr,
        code:       b.material.code,
        unit:       b.material.unit ?? '',
        perUnit:    b.quantity,
        required,
        available,
        shortage:   shortage > 0 ? shortage : 0,
      };
    });
  }, [bom, form.quantity, productMap]);

  const hasShortage = requirements.some(r => r.shortage > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.productId)                       return setError('يجب اختيار المنتج النهائي');
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0)                      return setError('الكمية يجب أن تكون أكبر من صفر');
    if (bom.length === 0)                      return setError('لا توجد قائمة مواد (BOM) للمنتج المختار — أضف BOM أولاً');

    setSaving(true);
    try {
      const res = await fetch('/api/production-orders', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId:         form.productId,
          quantity:          qty,
          plannedQuantity:   qty,
          remaining:         qty,
          productionLineId:  form.productionLineId || undefined,
          laborCost:         parseFloat(form.laborCost)    || 0,
          overheadCost:      parseFloat(form.overheadCost) || 0,
          date:              form.date,
          notes:             form.notes.trim() || undefined,
          status:            'pending',
        }),
      });
      const j = await res.json();
      if (j.success) {
        showToast('تم إنشاء أمر الإنتاج', 'success');
        setTimeout(() => router.push('/manufacturing/production-orders'), 600);
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
        title="إنشاء أمر إنتاج جديد"
        subtitle="حدّد المنتج النهائي والكمية، وسيتم حساب احتياجات المواد تلقائياً من قائمة المواد"
        backHref="/manufacturing/production-orders"
        icon={<ClipboardList className="w-5 h-5" />}
        error={error}
        saving={saving}
        formId="production-order-form"
        primaryLabel="حفظ الأمر"
        primaryDisabled={!form.productId || !form.quantity || bom.length === 0}
      >
        <form id="production-order-form" onSubmit={handleSubmit} className="space-y-5">
          <Section title="بيانات الأمر" subtitle="المنتج النهائي وخط الإنتاج والكمية">
            <FieldGrid>
              <SelectField label="المنتج النهائي" required value={form.productId}
                onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                className="sm:col-span-2"
              >
                <option value="">— اختر المنتج —</option>
                {finishedProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} ({p.code})
                  </option>
                ))}
              </SelectField>

              <Field label="الكمية المراد إنتاجها" required type="number" min="0.01" step="0.01"
                value={form.quantity} placeholder="0"
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />

              <Field label="التاريخ" required type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />

              <SelectField label="خط الإنتاج (اختياري)" value={form.productionLineId}
                onChange={e => setForm(f => ({ ...f, productionLineId: e.target.value }))}
                className="sm:col-span-2"
              >
                <option value="">— بدون خط محدد —</option>
                {lines.filter(l => l.status === 'active').map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </SelectField>

              <TextAreaField label="ملاحظات" rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="أي ملاحظات إضافية…"
                className="sm:col-span-2" />
            </FieldGrid>
          </Section>

          <Section title="تكاليف الإنتاج" subtitle="تكاليف العمالة والتشغيل المتوقعة لهذا الأمر">
            <FieldGrid>
              <Field label="تكلفة العمالة (ج.م)" type="number" min="0" step="0.01"
                value={form.laborCost} placeholder="0"
                onChange={e => setForm(f => ({ ...f, laborCost: e.target.value }))} />
              <Field label="تكلفة التشغيل العام (ج.م)" type="number" min="0" step="0.01"
                value={form.overheadCost} placeholder="0"
                onChange={e => setForm(f => ({ ...f, overheadCost: e.target.value }))} />
            </FieldGrid>
          </Section>

          {form.productId && (
            <Section
              title="المواد المطلوبة من قائمة المواد"
              subtitle={
                bom.length === 0
                  ? 'لا توجد قائمة مواد لهذا المنتج — أضفها من قسم BOM أولاً'
                  : `${bom.length} مادة سيتم خصمها عند إكمال الأمر`
              }
              action={<Layers className="w-4 h-4 text-slate-400" />}
            >
              {bom.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  لا توجد قائمة مواد (BOM) معرّفة لهذا المنتج — لا يمكن إنشاء أمر إنتاج بدونها.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">المادة</th>
                        <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">للوحدة</th>
                        <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">المطلوب</th>
                        <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">المتوفر</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {requirements.map(r => (
                        <tr key={r.materialId}>
                          <td className="px-3 py-2 text-slate-800">
                            <div className="font-medium">{r.nameAr}</div>
                            <div className="text-xs text-slate-400 font-mono">{r.code}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-left tabular-nums">
                            {r.perUnit.toLocaleString('ar-EG')} {r.unit}
                          </td>
                          <td className="px-3 py-2 text-slate-700 font-semibold text-left tabular-nums">
                            {r.required.toLocaleString('ar-EG')} {r.unit}
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-left tabular-nums">
                            {r.available.toLocaleString('ar-EG')} {r.unit}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r.shortage > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                                <AlertTriangle className="w-3 h-3" /> نقص {r.shortage.toLocaleString('ar-EG')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                                متوفر
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {hasShortage && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  بعض المواد ناقصة في المخزون — يمكنك حفظ الأمر كمعلّق وستحتاج لاستلام المواد قبل إكماله.
                </div>
              )}
            </Section>
          )}
        </form>
      </EntityFormPage>
    </>
  );
}
