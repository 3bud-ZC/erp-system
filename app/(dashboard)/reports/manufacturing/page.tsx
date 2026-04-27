'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import {
  ReportShell, ReportLabel, reportInputCls, fmtMoneyEGP, ReportSummaryCard,
} from '@/components/reports/ReportShell';

interface ProductionOrderLite {
  id: string;
  orderNumber: string;
  status: string;
  quantity: number;
  actualOutputQuantity?: number;
  produced?: number;
  cost?: number;
  date: string;
  product?: { nameAr?: string; code?: string; unit?: string };
  productionLine?: { id: string; name?: string };
  workInProgress?: { rawMaterialCost?: number; laborCost?: number; overheadCost?: number; totalCost?: number } | null;
}
interface WasteLite {
  id: string;
  date: string;
  quantity: number;
  productId: string;
  product?: { nameAr?: string; code?: string; unit?: string };
}

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export default function ManufacturingReportPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to,   setTo]   = useState(today());

  const ordersQ = useQuery({
    queryKey: ['production-orders'],
    queryFn:  () => apiGet<ProductionOrderLite[]>('/api/production-orders'),
    staleTime: 30_000,
  });
  const wasteQ = useQuery({
    queryKey: ['production-waste'],
    queryFn:  () => apiGet<WasteLite[]>('/api/production-waste'),
    staleTime: 30_000,
  });

  const orders = useMemo(() => ordersQ.data ?? [], [ordersQ.data]);
  const wastes = useMemo(() => wasteQ.data   ?? [], [wasteQ.data]);

  const filtered = useMemo(() => {
    const f = new Date(from), t = new Date(to);
    t.setHours(23, 59, 59, 999);
    return {
      orders: orders.filter(o => {
        const d = new Date(o.date);
        return d >= f && d <= t;
      }),
      wastes: wastes.filter(w => {
        const d = new Date(w.date);
        return d >= f && d <= t;
      }),
    };
  }, [orders, wastes, from, to]);

  const summary = useMemo(() => {
    const completed   = filtered.orders.filter(o => o.status === 'completed');
    const totalProduced = completed.reduce((s, o) => s + (o.actualOutputQuantity ?? o.produced ?? 0), 0);
    const totalCost     = completed.reduce((s, o) => s + (o.workInProgress?.totalCost ?? o.cost ?? 0), 0);
    const totalWaste    = filtered.wastes.reduce((s, w) => s + (w.quantity || 0), 0);
    return {
      totalOrders:    filtered.orders.length,
      completedOrders: completed.length,
      totalProduced,
      totalCost,
      totalWaste,
    };
  }, [filtered]);

  // Per-line breakdown
  const perLine = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; produced: number; cost: number }>();
    for (const o of filtered.orders) {
      const key = o.productionLine?.id ?? 'unassigned';
      const name = o.productionLine?.name ?? 'بدون خط محدد';
      const e = map.get(key);
      const produced = o.actualOutputQuantity ?? o.produced ?? 0;
      const cost     = o.workInProgress?.totalCost ?? o.cost ?? 0;
      if (e) { e.orders += 1; e.produced += produced; e.cost += cost; }
      else map.set(key, { name, orders: 1, produced, cost });
    }
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders);
  }, [filtered.orders]);

  const periodLabel = `من ${new Date(from).toLocaleDateString('ar-EG')} إلى ${new Date(to).toLocaleDateString('ar-EG')}`;

  return (
    <ReportsLayout title="تقرير التصنيع" subtitle="أوامر الإنتاج، الفاقد، والتكاليف الصناعية">
      <ReportShell
        title="تقرير التصنيع"
        subtitle="ملخص أوامر الإنتاج والفاقد والتكاليف"
        periodLabel={periodLabel}
        loading={ordersQ.isLoading || wasteQ.isLoading}
        error={(ordersQ.error || wasteQ.error) ? ((ordersQ.error || wasteQ.error) as Error).message : null}
        filters={
          <>
            <div>
              <ReportLabel>من تاريخ</ReportLabel>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={reportInputCls} />
            </div>
            <div>
              <ReportLabel>إلى تاريخ</ReportLabel>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className={reportInputCls} />
            </div>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <ReportSummaryCard label="إجمالي الأوامر"      value={summary.totalOrders} />
          <ReportSummaryCard label="أوامر مكتملة"         value={summary.completedOrders} accent="bg-emerald-50 border-emerald-200" />
          <ReportSummaryCard label="إجمالي المنتج"        value={summary.totalProduced.toLocaleString('ar-EG')} />
          <ReportSummaryCard label="إجمالي تكلفة الإنتاج" value={fmtMoneyEGP(summary.totalCost)} accent="bg-blue-50 border-blue-200" />
          <ReportSummaryCard label="إجمالي الفاقد"         value={summary.totalWaste.toLocaleString('ar-EG')} accent="bg-red-50 border-red-200" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">حسب خط الإنتاج</h3>
          </div>
          {perLine.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">لا توجد بيانات</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-2 text-right text-xs font-semibold text-slate-500">الخط</th>
                  <th className="px-5 py-2 text-left  text-xs font-semibold text-slate-500">عدد الأوامر</th>
                  <th className="px-5 py-2 text-left  text-xs font-semibold text-slate-500">الكمية المنتجة</th>
                  <th className="px-5 py-2 text-left  text-xs font-semibold text-slate-500">التكلفة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {perLine.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-2 text-slate-800">{r.name}</td>
                    <td className="px-5 py-2 text-left tabular-nums">{r.orders}</td>
                    <td className="px-5 py-2 text-left tabular-nums">{r.produced.toLocaleString('ar-EG')}</td>
                    <td className="px-5 py-2 text-left tabular-nums font-semibold">{fmtMoneyEGP(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">سجل الفاقد ({filtered.wastes.length})</h3>
          </div>
          {filtered.wastes.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">لا توجد سجلات فاقد في هذه الفترة</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">المنتج</th>
                  <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">الكمية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.wastes.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">{new Date(w.date).toLocaleDateString('ar-EG')}</td>
                    <td className="px-3 py-2 text-slate-800">{w.product?.nameAr ?? '—'}</td>
                    <td className="px-3 py-2 text-left tabular-nums text-red-600 font-semibold">
                      -{w.quantity.toLocaleString('ar-EG')} {w.product?.unit ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ReportShell>
    </ReportsLayout>
  );
}
