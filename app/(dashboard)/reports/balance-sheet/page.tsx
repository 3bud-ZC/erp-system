'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import {
  ReportShell, ReportLabel, reportInputCls, fmtMoneyEGP, ReportSummaryCard,
} from '@/components/reports/ReportShell';

interface BSLine { code: string; nameAr: string; amount: number }
interface BSResponse {
  asOfDate: string;
  assets:      { lines: BSLine[]; total: number };
  liabilities: { lines: BSLine[]; total: number };
  equity:      { lines: BSLine[]; netIncome: number; total: number; totalWithIncome: number };
  summary: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
    difference: number;
  };
}

const today = () => new Date().toISOString().slice(0, 10);

export default function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(today());

  const reportQ = useQuery({
    queryKey: ['balance-sheet', asOf],
    queryFn:  () => apiGet<BSResponse>(`/api/reports/balance-sheet?asOfDate=${asOf}`),
    staleTime: 0,
  });
  const data = reportQ.data;

  return (
    <ReportsLayout title="الميزانية العمومية" subtitle="الأصول، الخصوم، وحقوق الملكية في تاريخ محدد">
      <ReportShell
        title="الميزانية العمومية"
        subtitle="الأصول = الخصوم + حقوق الملكية"
        periodLabel={`بتاريخ ${new Date(asOf).toLocaleDateString('ar-EG')}`}
        loading={reportQ.isLoading}
        error={reportQ.error ? (reportQ.error as Error).message : null}
        filters={
          <div>
            <ReportLabel>بتاريخ</ReportLabel>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className={reportInputCls} />
          </div>
        }
      >
        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ReportSummaryCard label="إجمالي الأصول" value={fmtMoneyEGP(data.summary.totalAssets)} accent="bg-blue-50 border-blue-200" />
              <ReportSummaryCard label="إجمالي الخصوم" value={fmtMoneyEGP(data.summary.totalLiabilities)} accent="bg-amber-50 border-amber-200" />
              <ReportSummaryCard label="إجمالي حقوق الملكية" value={fmtMoneyEGP(data.summary.totalEquity)} accent="bg-emerald-50 border-emerald-200" />
            </div>

            {!data.summary.isBalanced && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                ⚠ الميزانية غير متوازنة — الفرق: {fmtMoneyEGP(data.summary.difference)}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BSSection title="الأصول" lines={data.assets.lines} total={data.assets.total} accent="text-blue-700" />
              <div className="space-y-4">
                <BSSection title="الخصوم" lines={data.liabilities.lines} total={data.liabilities.total} accent="text-amber-700" />
                <BSSection title="حقوق الملكية"
                  lines={[
                    ...data.equity.lines,
                    { code: '—', nameAr: 'صافي الربح للفترة', amount: data.equity.netIncome },
                  ]}
                  total={data.equity.totalWithIncome} accent="text-emerald-700" />
              </div>
            </div>

            <div className={`rounded-xl p-4 text-sm flex justify-between items-center border ${data.summary.isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <span className="font-bold text-slate-900">إجمالي الخصوم + حقوق الملكية</span>
              <span className="font-bold text-slate-900 tabular-nums text-base">{fmtMoneyEGP(data.summary.totalLiabilitiesAndEquity)}</span>
            </div>
          </>
        )}
      </ReportShell>
    </ReportsLayout>
  );
}

function BSSection({ title, lines, total, accent }: { title: string; lines: BSLine[]; total: number; accent: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className={`text-sm font-bold tabular-nums ${accent}`}>{fmtMoneyEGP(total)}</span>
      </div>
      {lines.length === 0 ? (
        <div className="p-4 text-center text-slate-400 text-xs">لا توجد بنود</div>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-5 py-2 font-mono text-slate-500 w-20">{l.code}</td>
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
