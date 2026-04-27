'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import {
  ReportShell, ReportLabel, reportInputCls, fmtMoneyEGP, ReportSummaryCard,
} from '@/components/reports/ReportShell';

interface SupplierLite {
  id: string; code: string; nameAr: string;
  phone?: string | null; email?: string | null; address?: string | null;
}
interface StatementResponse {
  supplier:       SupplierLite;
  period:         { from: string; to: string };
  openingBalance: number;
  transactions:   Array<{
    date:        string;
    type:        string;
    reference:   string;
    description: string;
    debit:       number;
    credit:      number;
    balance:     number;
  }>;
  summary: {
    totalInvoices?: number;
    totalReturns?:  number;
    totalPayments?: number;
    closingBalance?: number;
  };
}

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

export default function SupplierStatementPage() {
  const [from, setFrom] = useState(yearStart());
  const [to,   setTo]   = useState(today());
  const [supplierId, setSupplierId] = useState('');

  const suppliersQ = useQuery({
    queryKey: ['suppliers'],
    queryFn:  () => apiGet<SupplierLite[]>('/api/suppliers'),
    staleTime: 60_000,
  });
  const suppliers = useMemo(() => suppliersQ.data ?? [], [suppliersQ.data]);

  const statementQ = useQuery({
    queryKey: ['supplier-statement', supplierId, from, to],
    queryFn:  () => apiGet<StatementResponse>(
      `/api/reports/supplier-statement?supplierId=${supplierId}&fromDate=${from}&toDate=${to}`,
    ),
    enabled: !!supplierId,
    staleTime: 0,
  });

  const data = statementQ.data;

  const periodLabel = `من ${new Date(from).toLocaleDateString('ar-EG')} إلى ${new Date(to).toLocaleDateString('ar-EG')}`;

  return (
    <ReportsLayout title="كشف حساب مورد" subtitle="فواتير، مدفوعات، ورصيد المورد خلال فترة محددة">
      <ReportShell
        title={data ? `كشف حساب — ${data.supplier.nameAr}` : 'كشف حساب مورد'}
        subtitle={data ? `الرمز: ${data.supplier.code}` : undefined}
        periodLabel={periodLabel}
        loading={statementQ.isLoading}
        error={statementQ.error ? (statementQ.error as Error).message : null}
        filters={
          <>
            <div>
              <ReportLabel>المورد</ReportLabel>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={reportInputCls}>
                <option value="">— اختر المورد —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.nameAr} ({s.code})</option>)}
              </select>
            </div>
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
        {!supplierId ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
            اختر مورداً لاستعراض كشف حسابه
          </div>
        ) : data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <ReportSummaryCard label="رصيد افتتاحي" value={fmtMoneyEGP(data.openingBalance)} />
              <ReportSummaryCard label="إجمالي الفواتير" value={fmtMoneyEGP(data.summary.totalInvoices)} accent="bg-emerald-50 border-emerald-200" />
              <ReportSummaryCard label="إجمالي المدفوعات" value={fmtMoneyEGP(data.summary.totalPayments)} accent="bg-blue-50 border-blue-200" />
              <ReportSummaryCard label="الرصيد الختامي" value={fmtMoneyEGP(data.summary.closingBalance)} accent="bg-amber-50 border-amber-200" />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">الحركات ({data.transactions.length})</h3>
              </div>
              {data.transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">لا توجد حركات</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">المرجع</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">البيان</th>
                        <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">مدين</th>
                        <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">دائن</th>
                        <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.transactions.map((t, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-500">{new Date(t.date).toLocaleDateString('ar-EG')}</td>
                          <td className="px-3 py-2 font-mono text-slate-700">{t.reference}</td>
                          <td className="px-3 py-2 text-slate-800">{t.description}</td>
                          <td className="px-3 py-2 text-left tabular-nums">
                            {Number(t.debit) > 0 ? fmtMoneyEGP(t.debit) : '—'}
                          </td>
                          <td className="px-3 py-2 text-left tabular-nums">
                            {Number(t.credit) > 0 ? fmtMoneyEGP(t.credit) : '—'}
                          </td>
                          <td className="px-3 py-2 text-left tabular-nums font-semibold">{fmtMoneyEGP(t.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </ReportShell>
    </ReportsLayout>
  );
}
