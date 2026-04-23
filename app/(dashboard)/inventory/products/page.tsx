'use client';

import { useEffect, useState } from 'react';
import { Plus, Eye, AlertTriangle } from 'lucide-react';

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

function formatSAR(v?: number) {
  if (v == null) return '—';
  return `${v.toLocaleString('ar-SA')} ر.س`;
}

const typeLabels: Record<string, string> = {
  finished_product: 'منتج نهائي',
  raw_material: 'مواد خام',
  packaging: 'تغليف',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/products', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) setProducts(j.data ?? []);
        else setError(j.message || 'فشل تحميل المنتجات');
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-slate-500">جاري تحميل المنتجات…</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-red-500">{error}</div>
    </div>
  );

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">المنتجات والمخزون</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          إضافة منتج
        </button>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
          لا توجد منتجات حتى الآن
        </div>
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
                    <td className="px-5 py-3 text-sm text-slate-600">{formatSAR(p.cost)}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{formatSAR(p.price)}</td>
                    <td className="px-5 py-3 text-sm">
                      {lowStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" /> مخزون منخفض
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                          متاح
                        </span>
                      )}
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
