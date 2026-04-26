'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { ShoppingCart, DollarSign, FileText, Building2 } from 'lucide-react';
import { ReportLayout, KpiCard } from '@/components/reports/ReportLayout';

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplier?: { nameAr?: string; name?: string };
  date: string;
  total: number;
  grandTotal?: number;
  paymentStatus?: string;
  status?: string;
}

function fmtMoney(v: number) {
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString('ar-EG'); }

export default function PurchasesReportPage() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = today.toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate,   setEndDate]   = useState(monthEnd);

  const invoicesQ = useQuery({
    queryKey: ['purchase-invoices', 'report'],
    queryFn: () => apiGet<PurchaseInvoice[]>('/api/purchase-invoices'),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const all = invoicesQ.data ?? [];
    const start = new Date(startDate).getTime();
    const end   = new Date(endDate).getTime() + 86_400_000;
    return all.filter(inv => {
      const t = new Date(inv.date).getTime();
      return t >= start && t < end;
    });
  }, [invoicesQ.data, startDate, endDate]);

  const kpis = useMemo(() => {
    let total = 0, count = filtered.length, paid = 0, paidCount = 0;
    const suppliers = new Set<string>();
    for (const inv of filtered) {
      const v = Number(inv.grandTotal ?? inv.total ?? 0);
      total += v;
      if (inv.paymentStatus === 'paid' || inv.status === 'paid') {
        paid += v; paidCount++;
      }
      if (inv.supplierId) suppliers.add(inv.supplierId);
    }
    return { total, count, paid, paidCount, suppliers: suppliers.size };
  }, [filtered]);

  const topSuppliers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const inv of filtered) {
      const key = inv.supplierId;
      const name = inv.supplier?.nameAr || inv.supplier?.name || key;
      const cur = map.get(key) ?? { name, total: 0, count: 0 };
      cur.total += Number(inv.grandTotal ?? inv.total ?? 0);
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filtered]);

  return (
    <ReportLayout
      title="تقارير المشتريات"
      subtitle="نظرة شاملة على المشتريات خلال الفترة المحددة"
      toolbar={
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <span className="text-slate-500">—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إجمالي المشتريات" value={fmtMoney(kpis.total)} icon={DollarSign} color="blue" />
        <KpiCard title="عدد الفواتير"      value={kpis.count}        icon={FileText}    color="purple" />
        <KpiCard title="مشتريات مدفوعة"   value={fmtMoney(kpis.paid)}
          subtitle={`${kpis.paidCount} فاتورة`} icon={ShoppingCart} color="green" />
        <KpiCard title="عدد الموردين"      value={kpis.suppliers}    icon={Building2}   color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">أفضل 5 موردين</h3>
          {topSuppliers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">لا توجد بيانات</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="text-right pb-2">المورد</th>
                  <th className="text-center pb-2">عدد الفواتير</th>
                  <th className="text-left pb-2">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topSuppliers.map(s => (
                  <tr key={s.name}>
                    <td className="py-2 text-slate-700">{s.name}</td>
                    <td className="py-2 text-center text-slate-600">{s.count}</td>
                    <td className="py-2 text-left font-semibold tabular-nums">{fmtMoney(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">آخر فواتير المشتريات</h3>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">لا توجد فواتير في هذه الفترة</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="text-right pb-2">رقم الفاتورة</th>
                  <th className="text-right pb-2">التاريخ</th>
                  <th className="text-left pb-2">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice(0, 8).map(inv => (
                  <tr key={inv.id}>
                    <td className="py-2 text-slate-700 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="py-2 text-slate-600">{fmtDate(inv.date)}</td>
                    <td className="py-2 text-left font-semibold tabular-nums">{fmtMoney(Number(inv.grandTotal ?? inv.total ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ReportLayout>
  );
}
