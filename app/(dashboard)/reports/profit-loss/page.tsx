'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import {
  ReportShell, ReportLabel, reportInputCls, fmtMoneyEGP, ReportSummaryCard,
} from '@/components/reports/ReportShell';

interface PLLine { code: string; nameAr: string; amount: number }
interface PLResponse {
  period:  { from: string; to: string };
  revenue: { lines: PLLine[]; total: number };
  cogs:    { lines: PLLine[]; total: number };
  grossProfit: number;
  operatingExpenses: { lines: PLLine[]; total: number };
  netProfit: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

export default function ProfitLossPage() {
  const [from, setFrom] = useState(yearStart());
  const [to,   setTo]   = useState(today());

  const reportQ = useQuery({
    queryKey: ['profit-loss', from, to],
    queryFn:  () => apiGet<PLResponse>(`/api/reports/profit-loss?fromDate=${from}&toDate=${to}`),
    staleTime: 0,
  });
  const data = reportQ.data;

  const periodLabel = `من ${new Date(from).toLocaleDateString('ar-EG')} إلى ${new Date(to).toLocaleDateString('ar-EG')}`;

  return (
    <ReportsLayout title="قائمة الدخل" subtitle="الإيرادات والمصروفات وصافي الربح للفترة">
      <ReportShell
        title="قائمة الدخل (P&L)"
        subtitle="الإيرادات، تكلفة المبيعات، والمصروفات التشغيلية"
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
          </>
        }
      >
        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <ReportSummaryCard label="إجمالي الإيرادات" value={fmtMoneyEGP(data.revenue.total)} accent="bg-emerald-50 border-emerald-200" />
              <ReportSummaryCard label="تكلفة المبيعات" value={fmtMoneyEGP(data.cogs.total)} accent="bg-amber-50 border-amber-200" />
              <ReportSummaryCard label="مجمل الربح" value={fmtMoneyEGP(data.grossProfit)} accent="bg-blue-50 border-blue-200" />
              <ReportSummaryCard label="صافي الربح"
                value={fmtMoneyEGP(data.netProfit)}
                accent={data.netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} />
            </div>

            <PLSection title="الإيرادات" lines={data.revenue.lines} total={data.revenue.total} positive />
            <PLSection title="تكلفة المبيعات" lines={data.cogs.lines} total={data.cogs.total} />
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-sm flex justify-between items-center">
              <span className="font-semibold text-blue-900">مجمل الربح</span>
              <span className="font-bold text-blue-900 tabular-nums">{fmtMoneyEGP(data.grossProfit)}</span>
            </div>
            <PLSection title="المصروفات التشغيلية" lines={data.operatingExpenses.lines} total={data.operatingExpenses.total} />
            <div className={`${data.netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} border rounded-xl p-4 text-sm flex justify-between items-center`}>
              <span className="font-bold text-slate-900">صافي الربح / (الخسارة)</span>
              <span className="font-bold text-slate-900 tabular-nums text-base">{fmtMoneyEGP(data.netProfit)}</span>
            </div>
          </>
        )}
      </ReportShell>
    </ReportsLayout>
  );
}

function PLSection({ title, lines, total, positive }: { title: string; lines: PLLine[]; total: number; positive?: boolean }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className={`text-sm font-bold tabular-nums ${positive ? 'text-emerald-700' : 'text-slate-900'}`}>
          {fmtMoneyEGP(total)}
        </span>
      </div>
      {lines.length === 0 ? (
        <div className="p-4 text-center text-slate-400 text-xs">لا توجد بنود في هذه الفئة</div>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {lines.map(l => (
              <tr key={l.code} className="hover:bg-slate-50">
                <td className="px-5 py-2 font-mono text-slate-500 w-24">{l.code}</td>
                <td className="px-3 py-2 text-slate-800">{l.nameAr}</td>
                <td className="px-5 py-2 text-left tabular-nums">{fmtMoneyEGP(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
