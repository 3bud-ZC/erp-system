'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import {
  ReportShell, ReportLabel, reportInputCls, fmtMoneyEGP, ReportSummaryCard,
} from '@/components/reports/ReportShell';

interface ProductLite {
  id:        string;
  code:      string;
  nameAr:    string;
  type?:     string | null;
  unit?:     string | null;
  stock:     number;
  minStock?: number;
  cost:      number;
  price:     number;
}

const TYPE_OPTS = [
  { k: 'all',              label: 'جميع الأنواع' },
  { k: 'finished_product', label: 'منتجات نهائية' },
  { k: 'raw_material',     label: 'مواد خام' },
];

export default function InventoryReportPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');

  const productsQ = useQuery({
    queryKey: ['products'],
    queryFn:  () => apiGet<ProductLite[]>('/api/products'),
    staleTime: 60_000,
  });
  const products = useMemo(() => productsQ.data ?? [], [productsQ.data]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (typeFilter !== 'all' && (p.type ?? 'finished_product') !== typeFilter) return false;
      const min = p.minStock ?? 0;
      if (statusFilter === 'low' && p.stock > min) return false;
      if (statusFilter === 'low' && p.stock === 0) return false;
      if (statusFilter === 'out' && p.stock !== 0) return false;
      return true;
    });
  }, [products, typeFilter, statusFilter]);

  const summary = useMemo(() => {
    let totalValue = 0, lowStock = 0, outOfStock = 0;
    for (const p of products) {
      totalValue += p.stock * p.cost;
      const min = p.minStock ?? 0;
      if (p.stock === 0)            outOfStock += 1;
      else if (p.stock <= min)      lowStock   += 1;
    }
    return {
      totalProducts: products.length,
      totalValue,
      lowStock,
      outOfStock,
    };
  }, [products]);

  return (
    <ReportsLayout title="تقرير المخازن" subtitle="أرصدة المخزون، التكلفة، وقيمة الجرد">
      <ReportShell
        title="تقرير المخازن"
        subtitle="أرصدة المخزون والقيمة الكلية"
        periodLabel={`بتاريخ ${new Date().toLocaleDateString('ar-EG')}`}
        loading={productsQ.isLoading}
        error={productsQ.error ? (productsQ.error as Error).message : null}
        filters={
          <>
            <div>
              <ReportLabel>النوع</ReportLabel>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={reportInputCls}>
                {TYPE_OPTS.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <ReportLabel>الحالة</ReportLabel>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className={reportInputCls}>
                <option value="all">الكل</option>
                <option value="low">منخفض المخزون</option>
                <option value="out">نافد</option>
              </select>
            </div>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ReportSummaryCard label="عدد المنتجات" value={summary.totalProducts} />
          <ReportSummaryCard label="قيمة المخزون" value={fmtMoneyEGP(summary.totalValue)} accent="bg-blue-50 border-blue-200" />
          <ReportSummaryCard label="منخفض المخزون" value={summary.lowStock} accent="bg-amber-50 border-amber-200" />
          <ReportSummaryCard label="نافد" value={summary.outOfStock} accent="bg-red-50 border-red-200" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">تفاصيل المنتجات ({filtered.length})</h3>
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">لا توجد منتجات مطابقة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">الرمز</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">الاسم</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">النوع</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">الرصيد</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">حد إعادة الطلب</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">التكلفة</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">سعر البيع</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">القيمة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(p => {
                    const value = p.stock * p.cost;
                    const min = p.minStock ?? 0;
                    const low = p.stock > 0 && p.stock <= min;
                    const out = p.stock === 0;
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50 ${out ? 'bg-red-50/40' : low ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-3 py-2 font-mono text-slate-500">{p.code}</td>
                        <td className="px-3 py-2 text-slate-800">{p.nameAr}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">
                          {p.type === 'raw_material' ? 'مواد خام' : 'منتج نهائي'}
                        </td>
                        <td className="px-3 py-2 text-left tabular-nums font-semibold">
                          {p.stock.toLocaleString('ar-EG')} {p.unit ?? ''}
                        </td>
                        <td className="px-3 py-2 text-left tabular-nums text-slate-500">
                          {min ? min.toLocaleString('ar-EG') : '—'}
                        </td>
                        <td className="px-3 py-2 text-left tabular-nums">{fmtMoneyEGP(p.cost)}</td>
                        <td className="px-3 py-2 text-left tabular-nums">{fmtMoneyEGP(p.price)}</td>
                        <td className="px-3 py-2 text-left tabular-nums font-semibold">{fmtMoneyEGP(value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-300">
                  <tr>
                    <td colSpan={7} className="px-3 py-2 text-xs font-semibold text-slate-700">إجمالي قيمة المخزون</td>
                    <td className="px-3 py-2 text-left tabular-nums font-bold text-slate-900">
                      {fmtMoneyEGP(filtered.reduce((s, p) => s + p.stock * p.cost, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </ReportShell>
    </ReportsLayout>
  );
}
