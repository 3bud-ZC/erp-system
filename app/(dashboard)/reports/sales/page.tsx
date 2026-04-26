'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import { TrendingUp, DollarSign, FileText, Users } from 'lucide-react';
import { ReportLayout, KpiCard } from '@/components/reports/ReportLayout';

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: { nameAr?: string; name?: string };
  date: string;
  total: number;
  grandTotal?: number;
  paymentStatus?: string;
  status?: string;
}

function fmtMoney(v: number) {
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-EG');
}

export default function SalesReportPage() {
  // Date filters — default to current month
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = today.toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate,   setEndDate]   = useState(monthEnd);

  const invoicesQ = useQuery({
    queryKey: ['sales-invoices', 'report'],
    queryFn: () => apiGet<SalesInvoice[]>('/api/sales-invoices'),
    staleTime: 30_000,
  });

  // Filter by date range
  const filtered = useMemo(() => {
    const all = invoicesQ.data ?? [];
    const start = new Date(startDate).getTime();
    const end   = new Date(endDate).getTime() + 86_400_000; // include end day
    return all.filter(inv => {
      const t = new Date(inv.date).getTime();
      return t >= start && t < end;
    });
  }, [invoicesQ.data, startDate, endDate]);

  // KPIs
  const kpis = useMemo(() => {
    let total = 0, count = filtered.length, paid = 0, paidCount = 0;
    const customers = new Set<string>();
    for (const inv of filtered) {
      const v = Number(inv.grandTotal ?? inv.total ?? 0);
      total += v;
      if (inv.paymentStatus === 'paid' || inv.status === 'paid') {
        paid += v; paidCount++;
      }
      if (inv.customerId) customers.add(inv.customerId);
    }
    return { total, count, paid, paidCount, customers: customers.size };
  }, [filtered]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const inv of filtered) {
      const key = inv.customerId;
      const name = inv.customer?.nameAr || inv.customer?.name || key;
      const cur = map.get(key) ?? { name, total: 0, count: 0 };
      cur.total += Number(inv.grandTotal ?? inv.total ?? 0);
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filtered]);

  return (
    <ReportLayout
      title="تقارير المبيعات"
      subtitle="نظرة شاملة على أداء المبيعات خلال الفترة المحددة"
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
        <KpiCard title="إجمالي المبيعات" value={fmtMoney(kpis.total)} icon={DollarSign} color="green" />
        <KpiCard title="عدد الفواتير"     value={kpis.count}        icon={FileText}    color="blue" />
        <KpiCard title="مبيعات مدفوعة"   value={fmtMoney(kpis.paid)}
          subtitle={`${kpis.paidCount} فاتورة`} icon={TrendingUp} color="purple" />
        <KpiCard title="عدد العملاء"      value={kpis.customers}    icon={Users}       color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top customers */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">أفضل 5 عملاء</h3>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">لا توجد بيانات</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="text-right pb-2">العميل</th>
                  <th className="text-center pb-2">عدد الفواتير</th>
                  <th className="text-left pb-2">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topCustomers.map(c => (
                  <tr key={c.name}>
                    <td className="py-2 text-slate-700">{c.name}</td>
                    <td className="py-2 text-center text-slate-600">{c.count}</td>
                    <td className="py-2 text-left font-semibold tabular-nums">{fmtMoney(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent invoices */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">آخر الفواتير</h3>
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
