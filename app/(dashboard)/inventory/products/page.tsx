'use client';

import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, X } from 'lucide-react';

interface Product {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type?: string;
  unit?: string;
  stock: number;
  minStock?: number;
  cost: number;
  price: number;
}

function formatEGP(v?: number) {
  if (v == null) return '—';
  return `${v.toLocaleString('ar-EG')} ج.م`;
}

const typeLabels: Record<string, string> = {
  finished_product: 'منتج نهائي',
  raw_material: 'مواد خام',
  packaging: 'تغليف',
};

const emptyForm = { code: '', nameAr: '', nameEn: '', type: 'finished_product', unit: 'قطعة', price: '', cost: '', stock: '0', minStock: '' };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function load() {
    setLoading(true);
    fetch('/api/products', { credentials: 'include' })
      .then(r => r.json())
      .then(j => { if (j.success) setProducts(j.data ?? []); else setError(j.message || 'فشل التحميل'); })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      const res = await fetch('/api/products', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          nameAr: form.nameAr,
          ...(form.nameEn && { nameEn: form.nameEn }),
          type: form.type,
          unit: form.unit || 'قطعة',
          price: Number(form.price) || 0,
          cost: Number(form.cost) || 0,
          stock: Number(form.stock) || 0,
          ...(form.minStock && { minStock: Number(form.minStock) }),
        }),
      });
      const j = await res.json();
      if (j.success) { setShowModal(false); setForm(emptyForm); load(); }
      else setFormError(j.message || j.error || 'فشل الحفظ');
    } catch { setFormError('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64" dir="rtl"><div className="text-slate-500">جاري تحميل المنتجات…</div></div>;
  if (error) return <div className="flex items-center justify-center h-64" dir="rtl"><div className="text-red-500">{error}</div></div>;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">المنتجات والمخزون</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> إضافة منتج
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-900">إضافة منتج جديد</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الرمز *</label>
                  <input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="PRD-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">النوع</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="finished_product">منتج نهائي</option>
                    <option value="raw_material">مواد خام</option>
                    <option value="packaging">تغليف</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الاسم بالعربية *</label>
                <input required value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="اسم المنتج" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الاسم بالإنجليزية</label>
                <input value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Product Name" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">سعر البيع (ج.م) *</label>
                  <input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">التكلفة (ج.م)</label>
                  <input type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">وحدة القياس</label>
                  <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="قطعة" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">المخزون الابتدائي</label>
                  <input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الحد الأدنى للمخزون</label>
                  <input type="number" min="0" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? 'جاري الحفظ…' : 'حفظ'}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-200 transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">لا توجد منتجات حتى الآن</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الرمز</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الاسم</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">النوع</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">المخزون</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الحد الأدنى</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التكلفة</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">سعر البيع</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">حالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map(p => {
                const lowStock = p.stock <= (p.minStock ?? 0);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-slate-600">{p.code}</td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{p.nameAr}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{typeLabels[p.type ?? ''] ?? p.type ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 font-semibold">{p.stock} {p.unit ?? ''}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{p.minStock ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatEGP(p.cost)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatEGP(p.price)}</td>
                    <td className="px-5 py-3 text-sm">
                      {lowStock
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium"><AlertTriangle className="w-3 h-3" /> مخزون منخفض</span>
                        : <span className="inline-flex px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">متاح</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
