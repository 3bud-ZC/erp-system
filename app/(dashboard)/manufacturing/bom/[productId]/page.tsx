'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { ArrowRight, Layers, Plus, Trash2, AlertCircle, Package } from 'lucide-react';
import { Toast, useToast } from '@/components/ui/patterns';
import { Section } from '@/components/ui/modal';

interface ProductLite {
  id:     string;
  code:   string;
  nameAr: string;
  unit?:  string | null;
  type?:  string | null;
}
interface BOMItemEntry {
  id:        string;
  productId: string;
  materialId: string;
  quantity:  number;
  product:   { id: string; nameAr: string; code: string };
  material:  { id: string; nameAr: string; code: string; unit?: string | null };
}

export default function BOMEditPage() {
  const { productId } = useParams<{ productId: string }>();
  const qc = useQueryClient();
  const [toast, showToast] = useToast();

  const productsQ = useQuery({
    queryKey: ['products'],
    queryFn:  () => apiGet<ProductLite[]>('/api/products'),
    staleTime: 60_000,
  });
  const bomQ = useQuery({
    queryKey: ['bom', productId],
    queryFn:  () => apiGet<BOMItemEntry[]>(`/api/bom?productId=${productId}`),
  });

  const products = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const bom      = useMemo(() => bomQ.data      ?? [], [bomQ.data]);
  const product  = useMemo(() => products.find(p => p.id === productId), [products, productId]);

  // Materials = anything that's not the product itself, not already in BOM,
  // and is a raw material (finished products can't be raw inputs of others).
  const availableMaterials = useMemo(() => {
    const usedIds = new Set(bom.map(b => b.materialId));
    return products.filter(p =>
      p.id !== productId &&
      !usedIds.has(p.id) &&
      (p.type === 'raw_material' || !p.type),
    );
  }, [products, bom, productId]);

  const [adding, setAdding]         = useState(false);
  const [addError, setAddError]     = useState<string | null>(null);
  const [addMaterial, setAddMaterial] = useState('');
  const [addQty, setAddQty]         = useState('');

  const reload = () => {
    qc.invalidateQueries({ queryKey: ['bom'] });
  };

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addMaterial)              return setAddError('اختر المادة');
    const qty = parseFloat(addQty);
    if (!qty || qty <= 0)          return setAddError('الكمية يجب أن تكون أكبر من صفر');

    setAdding(true);
    try {
      const res = await fetch('/api/bom', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, materialId: addMaterial, quantity: qty }),
      });
      const j = await res.json();
      if (j.success) {
        setAddMaterial(''); setAddQty('');
        reload();
        showToast('تمت إضافة المادة', 'success');
      } else {
        setAddError(j.message || j.error || 'فشل الإضافة');
      }
    } catch { setAddError('تعذر الاتصال بالخادم'); }
    finally { setAdding(false); }
  }

  async function handleUpdateQty(id: string, qty: number) {
    if (qty <= 0) return;
    try {
      const res = await fetch('/api/bom', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity: qty }),
      });
      const j = await res.json();
      if (j.success) { reload(); showToast('تم تحديث الكمية', 'success'); }
    } catch { /* silent */ }
  }

  async function handleDelete(id: string) {
    if (!confirm('حذف هذه المادة من القائمة؟')) return;
    try {
      const res = await fetch(`/api/bom?id=${id}`, { method: 'DELETE', credentials: 'include' });
      const j = await res.json();
      if (j.success) { reload(); showToast('تم حذف المادة', 'success'); }
    } catch { /* silent */ }
  }

  if (productsQ.isLoading || bomQ.isLoading) {
    return <div className="p-6 flex items-center justify-center h-64 text-slate-500" dir="rtl">جاري التحميل…</div>;
  }
  if (!product) {
    return <div className="p-6" dir="rtl">المنتج غير موجود.</div>;
  }

  return (
    <div className="p-6 space-y-5 pb-24" dir="rtl">
      <Toast toast={toast} />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">قائمة مواد · {product.nameAr}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              <span className="font-mono">{product.code}</span> · {bom.length} مادة في القائمة
            </p>
          </div>
        </div>

        <Link href="/manufacturing/bom"
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
        >
          <ArrowRight className="w-4 h-4" /> العودة لقوائم المواد
        </Link>
      </div>

      <div className="max-w-5xl space-y-5">
        <Section title="المواد في القائمة" subtitle="حدد كمية كل مادة لإنتاج وحدة واحدة من المنتج النهائي">
          {bom.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              لا توجد مواد بعد — أضف أول مادة من النموذج بالأسفل.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">المادة</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500 w-40">الكمية للوحدة</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 w-20">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bom.map(b => (
                    <tr key={b.id}>
                      <td className="px-3 py-2 text-slate-800">
                        <div className="font-medium">{b.material.nameAr}</div>
                        <div className="text-xs text-slate-400 font-mono">{b.material.code}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 justify-end">
                          <input type="number" min="0.01" step="0.01" defaultValue={b.quantity}
                            onBlur={e => {
                              const v = parseFloat(e.target.value);
                              if (v && v !== b.quantity) handleUpdateQty(b.id, v);
                            }}
                            className="w-24 border border-slate-300 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums" />
                          <span className="text-xs text-slate-500">{b.material.unit ?? ''}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleDelete(b.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="إضافة مادة جديدة" subtitle="اختر المادة وأدخل الكمية المطلوبة لكل وحدة من المنتج النهائي">
          <form onSubmit={handleAdd} className="space-y-3">
            {addError && (
              <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4" />{addError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <select value={addMaterial} onChange={e => setAddMaterial(e.target.value)}
                className="sm:col-span-7 w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500"
              >
                <option value="">— اختر المادة —</option>
                {availableMaterials.map(m => (
                  <option key={m.id} value={m.id}>{m.nameAr} ({m.code})</option>
                ))}
              </select>

              <input type="number" min="0.01" step="0.01" value={addQty}
                onChange={e => setAddQty(e.target.value)} placeholder="الكمية"
                className="sm:col-span-3 w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 tabular-nums" />

              <button type="submit" disabled={adding}
                className="sm:col-span-2 w-full px-4 py-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> {adding ? '…' : 'إضافة'}
              </button>
            </div>
          </form>
        </Section>
      </div>
    </div>
  );
}
