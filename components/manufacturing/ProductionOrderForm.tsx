'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Layers, AlertTriangle, Plus, Trash2, Sparkles } from 'lucide-react';
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

  /* Hybrid material editor:
   *   - On product select, the saved BOM (if any) auto-fills these rows.
   *   - User can add / remove / edit rows freely before saving.
   *   - On submit, we send `items` directly to the API so it skips its own
   *     BOM lookup and uses exactly what the user picked.
   *   - If no BOM exists, the table starts empty and the user enters rows manually.
   */
  type MaterialRow = { id: string; materialId: string; quantity: string };
  const [rows, setRows] = useState<MaterialRow[]>([]);

  /* Pull saved BOM for the selected product (template). */
  const bomQ = useQuery({
    queryKey: ['bom', form.productId],
    queryFn:  () => apiGet<BOMItemEntry[]>(`/api/bom?productId=${form.productId}`),
    enabled:  !!form.productId,
  });
  const bom = useMemo(() => bomQ.data ?? [], [bomQ.data]);

  // Tracks which product we last auto-filled for, so manual edits aren't
  // wiped if the BOM query refetches.
  const [autoFilledFor, setAutoFilledFor] = useState<string | null>(null);

  useEffect(() => {
    if (!form.productId) {
      if (autoFilledFor !== null) setAutoFilledFor(null);
      return;
    }
    if (bomQ.isLoading) return;
    if (autoFilledFor === form.productId) return;

    // First time we see this product — copy the BOM into the editable rows.
    setRows(
      bom.map((b, i) => ({
        id:         `${b.materialId}-${i}`,
        materialId: b.materialId,
        quantity:   String(b.quantity),
      })),
    );
    setAutoFilledFor(form.productId);
  }, [form.productId, bom, bomQ.isLoading, autoFilledFor]);

  // Raw-material picker options: only raw materials, exclude the chosen finished product.
  const rawMaterials = useMemo(
    () => products.filter(p =>
      (p.type ?? 'raw_material') === 'raw_material' && p.id !== form.productId,
    ),
    [products, form.productId],
  );
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p] as const)), [products]);

  const requirements = useMemo(() => {
    const qty = parseFloat(form.quantity) || 0;
    return rows.map(r => {
      const perUnit   = parseFloat(r.quantity) || 0;
      const required  = perUnit * qty;
      const product   = productMap.get(r.materialId);
      const available = product?.stock ?? 0;
      const shortage  = required - available;
      return {
        rowId:      r.id,
        materialId: r.materialId,
        nameAr:     product?.nameAr ?? '—',
        code:       product?.code ?? '',
        unit:       product?.unit ?? '',
        perUnit,
        required,
        available,
        shortage:   shortage > 0 ? shortage : 0,
      };
    });
  }, [rows, form.quantity, productMap]);

  const hasShortage = requirements.some(r => r.shortage > 0);

  // BOM templates are still useful even though they're not required:
  //   - We surface a "reset from BOM template" action so the user can revert
  //     manual edits to the saved recipe in one click.
  const isCustomized = useMemo(() => {
    if (!form.productId || bomQ.isLoading) return false;
    if (rows.length !== bom.length) return true;
    const bomMap = new Map(bom.map(b => [b.materialId, b.quantity]));
    return rows.some(r =>
      bomMap.get(r.materialId) !== parseFloat(r.quantity),
    );
  }, [rows, bom, form.productId, bomQ.isLoading]);

  function addRow() {
    setRows(rs => [...rs, { id: `new-${Date.now()}-${rs.length}`, materialId: '', quantity: '' }]);
  }
  function updateRow(id: string, patch: Partial<MaterialRow>) {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeRow(id: string) {
    setRows(rs => rs.filter(r => r.id !== id));
  }
  function resetFromBOM() {
    setRows(
      bom.map((b, i) => ({
        id:         `${b.materialId}-${i}`,
        materialId: b.materialId,
        quantity:   String(b.quantity),
      })),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.productId)                       return setError('يجب اختيار المنتج النهائي');
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0)                      return setError('الكمية يجب أن تكون أكبر من صفر');

    // Validate the manual material rows: at least one row, every row must have
    // a material + a positive quantity, no duplicates.
    const cleaned = rows
      .map(r => ({ materialId: r.materialId, quantity: parseFloat(r.quantity) }))
      .filter(r => r.materialId && r.quantity > 0);
    if (cleaned.length === 0) {
      return setError('يجب تحديد مادة خام واحدة على الأقل بكمية صحيحة');
    }
    const seen = new Set<string>();
    for (const r of cleaned) {
      if (seen.has(r.materialId)) {
        return setError('توجد مادة خام مكررة في القائمة');
      }
      seen.add(r.materialId);
    }

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
          // Send the editable rows as the source of truth (per-unit qty).
          items:             cleaned,
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
        subtitle="حدّد المنتج النهائي والكمية، واختر المواد الخام دلوقتي (تجي من الـ BOM إن وجد أو أضفها يدوياً)"
        backHref="/manufacturing/production-orders"
        icon={<ClipboardList className="w-5 h-5" />}
        error={error}
        saving={saving}
        formId="production-order-form"
        primaryLabel="حفظ الأمر"
        primaryDisabled={!form.productId || !form.quantity || rows.length === 0}
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
              title="المواد المطلوبة"
              subtitle={
                bomQ.isLoading
                  ? 'جاري تحميل قائمة المواد…'
                  : bom.length === 0
                    ? 'لا توجد وصفة (BOM) محفوظة — أضف المواد يدوياً، أو حفظها كـ BOM لاحقاً'
                    : `تم التعبئة تلقائياً من الـ BOM المحفوظ — يمكنك التعديل، الإضافة، أو الحذف قبل الحفظ`
              }
              action={<Layers className="w-4 h-4 text-slate-400" />}
            >
              {/* Editable material rows */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">المادة الخام</th>
                      <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500 w-32">للوحدة</th>
                      <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500 w-32">المطلوب</th>
                      <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500 w-28">المتوفر</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 w-28">الحالة</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">
                          لا توجد مواد بعد — اضغط «إضافة مادة» لبدء الإدخال.
                        </td>
                      </tr>
                    )}
                    {rows.map(row => {
                      const r = requirements.find(x => x.rowId === row.id);
                      return (
                        <tr key={row.id}>
                          <td className="px-3 py-2">
                            <select
                              value={row.materialId}
                              onChange={e => updateRow(row.id, { materialId: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">— اختر المادة —</option>
                              {rawMaterials
                                .filter(p =>
                                  // Allow currently-selected row's option to stay even if used by another row
                                  p.id === row.materialId ||
                                  !rows.some(rr => rr.id !== row.id && rr.materialId === p.id),
                                )
                                .map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.nameAr} ({p.code})
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" min="0" step="0.01"
                              value={row.quantity}
                              onChange={e => updateRow(row.id, { quantity: e.target.value })}
                              placeholder="0"
                              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm tabular-nums text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-700 font-semibold text-left tabular-nums">
                            {r ? `${r.required.toLocaleString('ar-EG')} ${r.unit}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-left tabular-nums">
                            {r ? `${r.available.toLocaleString('ar-EG')} ${r.unit}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {r && r.materialId && r.perUnit > 0 && (parseFloat(form.quantity) || 0) > 0 ? (
                              r.shortage > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                                  <AlertTriangle className="w-3 h-3" /> نقص {r.shortage.toLocaleString('ar-EG')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                                  متوفر
                                </span>
                              )
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium border border-blue-200 transition-colors"
                >
                  <Plus className="w-4 h-4" /> إضافة مادة
                </button>
                {bom.length > 0 && isCustomized && (
                  <button
                    type="button"
                    onClick={resetFromBOM}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg text-sm font-medium border border-slate-200 transition-colors"
                    title="إعادة تعبئة الصفوف من الـ BOM المحفوظ"
                  >
                    <Sparkles className="w-4 h-4" /> إعادة تعبئة من BOM
                  </button>
                )}
              </div>

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
