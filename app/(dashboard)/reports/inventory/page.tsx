'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { Package, AlertTriangle, DollarSign, Layers } from 'lucide-react';
import { ReportLayout, KpiCard } from '@/components/reports/ReportLayout';

interface Product {
  id: string;
  nameAr?: string;
  nameEn?: string;
  code: string;
  stock?: number;
  price?: number;
  cost?: number;
  reorderLevel?: number;
}

function fmtMoney(v: number) {
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

export default function InventoryReportPage() {
  const productsQ = useQuery({
    queryKey: ['products', 'inventory-report'],
    queryFn: () => apiGet<Product[]>('/api/products'),
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const products = productsQ.data ?? [];
    let totalCost = 0, totalRetail = 0, lowStock = 0, outOfStock = 0;
    for (const p of products) {
      const stock = Number(p.stock ?? 0);
      const cost  = Number(p.cost  ?? 0);
      const price = Number(p.price ?? 0);
      const reorder = Number(p.reorderLevel ?? 0);
      totalCost   += stock * cost;
      totalRetail += stock * price;
      if (stock <= 0) outOfStock++;
      else if (reorder > 0 && stock <= reorder) lowStock++;
    }
    return {
      totalProducts: products.length,
      totalCost,
      totalRetail,
      lowStock,
      outOfStock,
      potentialMargin: totalRetail - totalCost,
      list: products,
    };
  }, [productsQ.data]);

  const lowStockList = useMemo(() => {
    const items = stats.list.filter(p => {
      const stock = Number(p.stock ?? 0);
      const reorder = Number(p.reorderLevel ?? 0);
      return stock <= 0 || (reorder > 0 && stock <= reorder);
    });
    return items.slice(0, 20);
  }, [stats.list]);

  return (
    <ReportLayout
      title="تقارير المخزون"
      subtitle="مستويات المخزون، التقييم، والمنتجات منخفضة الكمية"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إجمالي المنتجات"  value={stats.totalProducts}      icon={Package}       color="blue" />
        <KpiCard title="قيمة المخزون (تكلفة)" value={fmtMoney(stats.totalCost)}    icon={DollarSign}    color="purple" />
        <KpiCard title="قيمة المخزون (بيع)"   value={fmtMoney(stats.totalRetail)}
          subtitle={`هامش متوقع: ${fmtMoney(stats.potentialMargin)}`}
          icon={Layers} color="green" />
        <KpiCard title="منتجات منخفضة" value={stats.lowStock + stats.outOfStock}
          subtitle={`${stats.outOfStock} نفدت / ${stats.lowStock} منخفض`}
          icon={AlertTriangle} color="red" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">منتجات تحتاج إعادة الطلب</h3>
          <span className="text-xs text-slate-400">{lowStockList.length} منتج</span>
        </div>
        {productsQ.isLoading ? (
          <p className="text-sm text-slate-400 text-center py-6">جاري التحميل…</p>
        ) : lowStockList.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">جميع المنتجات بمستويات جيدة 👍</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="text-right py-2 font-medium">المنتج</th>
                  <th className="text-center py-2 font-medium">الكود</th>
                  <th className="text-center py-2 font-medium">المخزون</th>
                  <th className="text-center py-2 font-medium">حد الطلب</th>
                  <th className="text-left py-2 font-medium">سعر التكلفة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockList.map(p => {
                  const stock = Number(p.stock ?? 0);
                  const reorder = Number(p.reorderLevel ?? 0);
                  const out = stock <= 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2 text-slate-700">{p.nameAr || p.nameEn || p.id}</td>
                      <td className="py-2 text-center text-slate-500 font-mono text-xs">{p.code}</td>
                      <td className={`py-2 text-center font-semibold ${out ? 'text-red-600' : 'text-amber-600'}`}>
                        {stock}
                      </td>
                      <td className="py-2 text-center text-slate-500">{reorder || '—'}</td>
                      <td className="py-2 text-left tabular-nums">{fmtMoney(Number(p.cost ?? 0))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ReportLayout>
  );
}
