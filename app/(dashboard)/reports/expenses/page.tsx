'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { ReportsLayout } from '@/components/reports/ReportsLayout';
import {
  ReportShell, ReportLabel, reportInputCls, fmtMoneyEGP, ReportSummaryCard,
} from '@/components/reports/ReportShell';

interface Expense {
  id:            string;
  date:          string;
  category:      string;
  amount:        number;
  description:   string;
  paymentMethod: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export default function ExpensesReportPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to,   setTo]   = useState(today());
  const [category, setCategory] = useState('');

  const expensesQ = useQuery({
    queryKey: ['expenses'],
    queryFn:  () => apiGet<Expense[]>('/api/expenses'),
    staleTime: 60_000,
  });
  const allExpenses = useMemo(() => expensesQ.data ?? [], [expensesQ.data]);

  const filtered = useMemo(() => {
    const f = new Date(from);
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    return allExpenses.filter(e => {
      const d = new Date(e.date);
      if (d < f || d > t) return false;
      if (category && e.category !== category) return false;
      return true;
    });
  }, [allExpenses, from, to, category]);

  const categories = useMemo(
    () => Array.from(new Set(allExpenses.map(e => e.category).filter(Boolean))),
    [allExpenses],
  );

  const summary = useMemo(() => {
    const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
    const byCategory = new Map<string, number>();
    const byMethod   = new Map<string, number>();
    for (const e of filtered) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount || 0));
      byMethod.set(e.paymentMethod, (byMethod.get(e.paymentMethod) ?? 0) + Number(e.amount || 0));
    }
    return {
      total,
      count:      filtered.length,
      byCategory: Array.from(byCategory.entries()).map(([k, v]) => ({ name: k, total: v })).sort((a, b) => b.total - a.total),
      byMethod:   Array.from(byMethod.entries()).map(([k, v]) => ({ name: k, total: v })).sort((a, b) => b.total - a.total),
    };
  }, [filtered]);

  const periodLabel = `من ${new Date(from).toLocaleDateString('ar-EG')} إلى ${new Date(to).toLocaleDateString('ar-EG')}`;

  return (
    <ReportsLayout title="تقرير المصروفات" subtitle="المصروفات حسب الفترة، التصنيف، وطريقة الدفع">
      <ReportShell
        title="تقرير المصروفات"
        subtitle="إجمالي المصروفات وتفصيلها"
        periodLabel={periodLabel}
        loading={expensesQ.isLoading}
        error={expensesQ.error ? (expensesQ.error as Error).message : null}
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
              <ReportLabel>التصنيف</ReportLabel>
              <select value={category} onChange={e => setCategory(e.target.value)} className={reportInputCls}>
                <option value="">— الكل —</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ReportSummaryCard label="عدد المصروفات" value={summary.count} />
          <ReportSummaryCard label="إجمالي المصروفات" value={fmtMoneyEGP(summary.total)} accent="bg-red-50 border-red-200" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">حسب التصنيف</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {summary.byCategory.length === 0 ? (
                  <tr><td className="p-4 text-center text-slate-400">لا توجد بيانات</td></tr>
                ) : summary.byCategory.map(r => (
                  <tr key={r.name} className="hover:bg-slate-50">
                    <td className="px-5 py-2 text-slate-800">{r.name}</td>
                    <td className="px-5 py-2 text-left tabular-nums font-semibold">{fmtMoneyEGP(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">حسب طريقة الدفع</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {summary.byMethod.length === 0 ? (
                  <tr><td className="p-4 text-center text-slate-400">لا توجد بيانات</td></tr>
                ) : summary.byMethod.map(r => (
                  <tr key={r.name} className="hover:bg-slate-50">
                    <td className="px-5 py-2 text-slate-800">{r.name}</td>
                    <td className="px-5 py-2 text-left tabular-nums font-semibold">{fmtMoneyEGP(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">تفاصيل المصروفات ({filtered.length})</h3>
          </div>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">لا توجد مصروفات في هذه الفترة</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">التصنيف</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">الوصف</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">طريقة الدفع</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500">{new Date(e.date).toLocaleDateString('ar-EG')}</td>
                      <td className="px-3 py-2 text-slate-700">{e.category}</td>
                      <td className="px-3 py-2 text-slate-800">{e.description}</td>
                      <td className="px-3 py-2 text-slate-500">{e.paymentMethod}</td>
                      <td className="px-3 py-2 text-left tabular-nums font-semibold text-red-600">{fmtMoneyEGP(e.amount)}</td>
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
