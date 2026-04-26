'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { Users, DollarSign, FileText, AlertCircle } from 'lucide-react';
import { ReportLayout, KpiCard } from '@/components/reports/ReportLayout';

interface Customer {
  id: string;
  nameAr?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  balance?: number;
  createdAt?: string;
}

interface SalesInvoice {
  id: string;
  customerId: string;
  customer?: { nameAr?: string; name?: string };
  total: number;
  grandTotal?: number;
  paidAmount?: number;
  paymentStatus?: string;
  status?: string;
  date: string;
}

function fmtMoney(v: number) {
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

export default function CustomersReportPage() {
  const customersQ = useQuery({
    queryKey: ['customers', 'report'],
    queryFn: () => apiGet<Customer[]>('/api/customers'),
    staleTime: 60_000,
  });

  const invoicesQ = useQuery({
    queryKey: ['sales-invoices', 'customers-report'],
    queryFn: () => apiGet<SalesInvoice[]>('/api/sales-invoices'),
    staleTime: 30_000,
  });

  // Aggregate per-customer totals
  const stats = useMemo(() => {
    const customers = customersQ.data ?? [];
    const invoices  = invoicesQ.data  ?? [];

    const byCustomer = new Map<string, {
      customer: Customer;
      totalSales: number;
      totalPaid: number;
      outstanding: number;
      invoiceCount: number;
      lastDate: string | null;
    }>();

    // Seed every customer (so 0-sales customers still show up in lists).
    for (const c of customers) {
      byCustomer.set(c.id, {
        customer: c,
        totalSales: 0,
        totalPaid: 0,
        outstanding: 0,
        invoiceCount: 0,
        lastDate: null,
      });
    }

    for (const inv of invoices) {
      const entry = byCustomer.get(inv.customerId);
      if (!entry) continue;
      const v = Number(inv.grandTotal ?? inv.total ?? 0);
      const paid = Number(inv.paidAmount ?? 0);
      entry.totalSales += v;
      entry.totalPaid  += paid;
      entry.outstanding += Math.max(0, v - paid);
      entry.invoiceCount += 1;
      if (!entry.lastDate || new Date(inv.date) > new Date(entry.lastDate)) {
        entry.lastDate = inv.date;
      }
    }

    const list = Array.from(byCustomer.values());
    const totalSales = list.reduce((s, x) => s + x.totalSales, 0);
    const totalOutstanding = list.reduce((s, x) => s + x.outstanding, 0);
    const activeCustomers = list.filter(x => x.invoiceCount > 0).length;
    const customersWithDebt = list.filter(x => x.outstanding > 0).length;

    return {
      list: list.sort((a, b) => b.totalSales - a.totalSales),
      totalSales,
      totalOutstanding,
      activeCustomers,
      customersWithDebt,
      totalCustomers: customers.length,
    };
  }, [customersQ.data, invoicesQ.data]);

  const loading = customersQ.isLoading || invoicesQ.isLoading;

  return (
    <ReportLayout
      title="تقارير العملاء"
      subtitle="رصيد العملاء، الذمم المدينة، وأكثر العملاء شراءً"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إجمالي العملاء"   value={stats.totalCustomers}    icon={Users}      color="blue" />
        <KpiCard title="عملاء نشطون"      value={stats.activeCustomers}   subtitle="عملاء لديهم فواتير" icon={FileText} color="green" />
        <KpiCard title="إجمالي المبيعات" value={fmtMoney(stats.totalSales)} icon={DollarSign} color="purple" />
        <KpiCard title="ذمم مدينة"        value={fmtMoney(stats.totalOutstanding)}
          subtitle={`${stats.customersWithDebt} عميل لديه رصيد`} icon={AlertCircle} color="red" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">تفاصيل العملاء</h3>
          <span className="text-xs text-slate-400">{stats.list.length} عميل</span>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">جاري التحميل…</p>
        ) : stats.list.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">لا توجد بيانات عملاء</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="text-right py-2 font-medium">العميل</th>
                  <th className="text-center py-2 font-medium">الفواتير</th>
                  <th className="text-left py-2 font-medium">إجمالي المبيعات</th>
                  <th className="text-left py-2 font-medium">المدفوع</th>
                  <th className="text-left py-2 font-medium">الرصيد المستحق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.list.slice(0, 30).map(x => (
                  <tr key={x.customer.id} className="hover:bg-slate-50">
                    <td className="py-2 text-slate-700">
                      {x.customer.nameAr || x.customer.name || x.customer.id}
                      {x.customer.phone && <span className="text-xs text-slate-400 me-2">· {x.customer.phone}</span>}
                    </td>
                    <td className="py-2 text-center text-slate-600">{x.invoiceCount}</td>
                    <td className="py-2 text-left font-semibold tabular-nums">{fmtMoney(x.totalSales)}</td>
                    <td className="py-2 text-left tabular-nums text-green-700">{fmtMoney(x.totalPaid)}</td>
                    <td className={`py-2 text-left tabular-nums font-semibold ${x.outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {fmtMoney(x.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ReportLayout>
  );
}
