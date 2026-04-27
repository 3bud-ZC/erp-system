'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import {
  ReportShell, ReportLabel, reportInputCls, fmtMoneyEGP, ReportSummaryCard,
} from '@/components/reports/ReportShell';

interface AgingDetail {
  entity:           { id: string; code: string; nameAr: string };
  balance:          number;
  daysOverdue:      number;
  bucket:           string;
  transactionCount: number;
}
interface AgingResponse {
  type:    string;
  asOfDate: string;
  summary: {
    totalOutstanding: number;
    agingBuckets:     Record<string, number>;
  };
  details: AgingDetail[];
}

const today = () => new Date().toISOString().slice(0, 10);

const BUCKET_LABELS: Record<string, string> = {
  current: 'حالي',
  '1-30':  '1-30 يوم',
  '31-60': '31-60 يوم',
  '61-90': '61-90 يوم',
  '90+':   'أكثر من 90 يوم',
};

export default function AgingReportPage() {
  const [type, setType]     = useState<'ar' | 'ap'>('ar');
  const [asOf, setAsOf]     = useState(today());

  const reportQ = useQuery({
    queryKey: ['aging', type, asOf],
    queryFn:  () => apiGet<AgingResponse>(`/api/reports/aging?type=${type}&asOfDate=${asOf}`),
    staleTime: 0,
  });
  const data = reportQ.data;

  return (
    <ReportsLayout title="تقرير الأعمار" subtitle="تحليل أعمار الذمم المدينة والدائنة حسب فترات الاستحقاق">
      <ReportShell
        title={type === 'ar' ? 'تقرير أعمار الذمم المدينة (العملاء)' : 'تقرير أعمار الذمم الدائنة (الموردين)'}
        subtitle="موزعة على فترات الاستحقاق"
        periodLabel={`بتاريخ ${new Date(asOf).toLocaleDateString('ar-EG')}`}
        loading={reportQ.isLoading}
        error={reportQ.error ? (reportQ.error as Error).message : null}
        filters={
          <>
            <div>
              <ReportLabel>نوع التقرير</ReportLabel>
              <select value={type} onChange={e => setType(e.target.value as 'ar' | 'ap')} className={reportInputCls}>
                <option value="ar">ذمم مدينة (عملاء)</option>
                <option value="ap">ذمم دائنة (موردين)</option>
              </select>
            </div>
            <div>
              <ReportLabel>بتاريخ</ReportLabel>
              <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className={reportInputCls} />
            </div>
          </>
        }
      >
        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <ReportSummaryCard label="الإجمالي" value={fmtMoneyEGP(data.summary.totalOutstanding)} accent="bg-blue-50 border-blue-200" />
              {Object.entries(data.summary.agingBuckets).map(([k, v]) => (
                <ReportSummaryCard key={k} label={BUCKET_LABELS[k] ?? k} value={fmtMoneyEGP(v)}
                  accent={k === 'current' ? 'bg-emerald-50 border-emerald-200' : k === '90+' ? 'bg-red-50 border-red-200' : undefined} />
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">
                  {type === 'ar' ? 'تفاصيل العملاء' : 'تفاصيل الموردين'} ({data.details.length})
                </h3>
              </div>
              {data.details.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">لا توجد ذمم</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">الرمز</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{type === 'ar' ? 'العميل' : 'المورد'}</th>
                        <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">الفترة</th>
                        <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">أيام التأخير</th>
                        <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">الرصيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.details.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-slate-500">{d.entity.code}</td>
                          <td className="px-3 py-2 text-slate-800">{d.entity.nameAr}</td>
                          <td className="px-3 py-2 text-left text-xs">{BUCKET_LABELS[d.bucket] ?? d.bucket}</td>
                          <td className="px-3 py-2 text-left tabular-nums">
                            {d.daysOverdue > 0 ? `${d.daysOverdue}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-left tabular-nums font-semibold">{fmtMoneyEGP(d.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-300">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-slate-700">الإجمالي</td>
                        <td className="px-3 py-2 text-left tabular-nums font-bold text-slate-900">
                          {fmtMoneyEGP(data.summary.totalOutstanding)}
                        </td>
                      </tr>
                    </tfoot>
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
