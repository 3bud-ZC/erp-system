'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import {
  ReportShell, ReportLabel, reportInputCls, fmtMoneyEGP, ReportSummaryCard,
} from '@/components/reports/ReportShell';

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  total: number;
  discount?: number;
  grandTotal?: number;
  paidAmount?: number;
  paymentStatus: string;
  status: string;
  customer?: { id: string; nameAr: string };
}

interface CustomerLite { id: string; nameAr: string }

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export default function SalesReportPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to,   setTo]   = useState(today());
  const [customerId, setCustomerId] = useState('');

  const customersQ = useQuery({
    queryKey: ['customers'],
    queryFn:  () => apiGet<CustomerLite[]>('/api/customers'),
    staleTime: 60_000,
  });
  const customers = useMemo(() => customersQ.data ?? [], [customersQ.data]);

  // We piggyback on /api/sales/reports which accepts fromDate/toDate/customerId.
  const reportQ = useQuery({
    queryKey: ['sales-report', from, to, customerId],
    queryFn:  () => {
      const url = new URL('/api/sales/reports', window.location.origin);
      url.searchParams.set('fromDate', from);
      url.searchParams.set('toDate',   to);
      if (customerId) url.searchParams.set('customerId', customerId);
      return apiGet<{
        invoices?:          SalesInvoice[];
        totalInvoices?:     number;
        totalSales?:        number;
        averageOrderValue?: number;
      }>(url.pathname + url.search);
    },
    staleTime: 0,
  });

  const data    = reportQ.data ?? {};
  const invoices = useMemo(() => data.invoices ?? [], [data.invoices]);
  const totalSales = data.totalSales ?? invoices.reduce((s, i) => s + Number(i.grandTotal ?? i.total ?? 0), 0);
  const totalPaid  = invoices.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0);
  const totalUnpaid = totalSales - totalPaid;
  const averageInv = invoices.length ? totalSales / invoices.length : 0;

  // Group by customer for the breakdown card.
  const perCustomer = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>();
    for (const inv of invoices) {
      const key = inv.customer?.id ?? 'unknown';
      const name = inv.customer?.nameAr ?? '—';
      const t = Number(inv.grandTotal ?? inv.total) || 0;
      const e = map.get(key);
      if (e) { e.count += 1; e.total += t; }
      else map.set(key, { name, count: 1, total: t });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [invoices]);

  const periodLabel = `من ${new Date(from).toLocaleDateString('ar-EG')} إلى ${new Date(to).toLocaleDateString('ar-EG')}`;

  return (
    <ReportsLayout title="تقرير المبيعات" subtitle="فواتير المبيعات والإجماليات حسب الفترة والعميل">
      <ReportShell
        title="تقرير المبيعات"
        subtitle="فواتير المبيعات والإجماليات"
        periodLabel={periodLabel}
        loading={reportQ.isLoading}
        error={reportQ.error ? (reportQ.error as Error).message : null}
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
            <div>
              <ReportLabel>العميل</ReportLabel>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} className={reportInputCls}>
                <option value="">— الكل —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
              </select>
            </div>
          </>
        }
      >
        {/* Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <ReportSummaryCard label="عدد الفواتير"   value={data.totalInvoices ?? invoices.length} />
          <ReportSummaryCard label="إجمالي المبيعات" value={fmtMoneyEGP(totalSales)} accent="bg-blue-50 border-blue-200" />
          <ReportSummaryCard label="متوسط الفاتورة" value={fmtMoneyEGP(averageInv)} />
          <ReportSummaryCard label="المسدّد"         value={fmtMoneyEGP(totalPaid)} accent="bg-emerald-50 border-emerald-200" />
          <ReportSummaryCard label="المتبقي"          value={fmtMoneyEGP(totalUnpaid)} accent="bg-amber-50 border-amber-200" />
        </div>

        {/* Per-customer breakdown */}
        {perCustomer.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">المبيعات حسب العميل</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-2 text-right text-xs font-semibold text-slate-500">العميل</th>
                  <th className="px-5 py-2 text-left  text-xs font-semibold text-slate-500">عدد الفواتير</th>
                  <th className="px-5 py-2 text-left  text-xs font-semibold text-slate-500">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {perCustomer.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-2 text-slate-800">{row.name}</td>
                    <td className="px-5 py-2 text-left tabular-nums">{row.count}</td>
                    <td className="px-5 py-2 text-left tabular-nums font-semibold text-slate-700">{fmtMoneyEGP(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invoices list */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">قائمة الفواتير ({invoices.length})</h3>
          </div>
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">لا توجد فواتير في هذه الفترة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">رقم الفاتورة</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">العميل</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">المجموع</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">الخصم</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">الإجمالي</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">المسدّد</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-slate-700">{inv.invoiceNumber}</td>
                      <td className="px-3 py-2 text-slate-500">{new Date(inv.date).toLocaleDateString('ar-EG')}</td>
                      <td className="px-3 py-2 text-slate-800">{inv.customer?.nameAr ?? '—'}</td>
                      <td className="px-3 py-2 text-left tabular-nums">{fmtMoneyEGP(inv.total)}</td>
                      <td className="px-3 py-2 text-left tabular-nums text-red-600">
                        {Number(inv.discount ?? 0) > 0 ? `- ${fmtMoneyEGP(inv.discount)}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-left tabular-nums font-semibold">{fmtMoneyEGP(inv.grandTotal ?? inv.total)}</td>
                      <td className="px-3 py-2 text-left tabular-nums text-emerald-600">{fmtMoneyEGP(inv.paidAmount)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-xs">
                          {inv.paymentStatus === 'cash' && 'نقداً'}
                          {inv.paymentStatus === 'credit' && 'آجل'}
                          {inv.paymentStatus === 'partial' && 'جزئي'}
                          {inv.paymentStatus === 'bank_transfer' && 'تحويل'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ReportShell>
    </ReportsLayout>
  );
}
