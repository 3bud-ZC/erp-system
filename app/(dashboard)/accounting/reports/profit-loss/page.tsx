'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Printer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AccountLine {
  code: string;
  nameAr: string;
  amount: number;
}

interface PLData {
  period: { from: string; to: string };
  revenue:          { lines: AccountLine[]; total: number };
  cogs:             { lines: AccountLine[]; total: number };
  grossProfit:      number;
  operatingExpenses:{ lines: AccountLine[]; total: number };
  netProfit:        number;
  isValid:          boolean;
}

function fmt(v: number) {
  return Math.abs(v).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function SectionRow({ label, amount, bold, indent, highlight }: {
  label: string; amount: number; bold?: boolean; indent?: boolean; highlight?: 'profit' | 'loss' | 'neutral';
}) {
  const isZero    = Math.abs(amount) < 0.01;
  const colorMap  = { profit: 'text-green-700', loss: 'text-red-600', neutral: 'text-slate-700' };
  const color     = highlight ? colorMap[highlight] : (isZero ? 'text-slate-400' : 'text-slate-800');

  return (
    <tr className={`border-b border-slate-100 ${bold ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}>
      <td className={`px-6 py-2.5 text-sm ${indent ? 'pr-10' : ''} ${bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
        {label}
      </td>
      <td className={`px-6 py-2.5 text-sm text-left tabular-nums ${bold ? 'font-bold' : ''} ${color}`}>
        {isZero ? '—' : fmt(amount)}
        {highlight === 'loss' && !isZero && <span className="text-xs mr-1">(خسارة)</span>}
      </td>
    </tr>
  );
}

export default function ProfitLossPage() {
  const [data, setData]       = useState<PLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const now = new Date();
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate]     = useState(now.toISOString().split('T')[0]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const q   = new URLSearchParams({ fromDate, toDate });
      const res = await fetch(`/api/reports/profit-loss?${q}`, { credentials: 'include' });
      const j   = await res.json();
      if (!j.success) throw new Error(j.message || 'فشل تحميل التقرير');
      setData(j.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const netColor = !data ? 'neutral'
    : data.netProfit > 0 ? 'profit'
    : data.netProfit < 0 ? 'loss'
    : 'neutral';

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">قائمة الدخل (الأرباح والخسائر)</h1>
          {data && (
            <p className="text-sm text-slate-500 mt-0.5">
              من {fmtDate(data.period.from)} إلى {fmtDate(data.period.to)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700">
            <Printer className="w-4 h-4" /> طباعة
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm text-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </button>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 mb-6 no-print">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 whitespace-nowrap">من تاريخ:</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 whitespace-nowrap">إلى تاريخ:</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={load}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          عرض التقرير
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">جاري تحميل قائمة الدخل…</div>
        </div>
      ) : !data ? null : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4 mb-6 no-print">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-xs text-slate-500">إجمالي الإيرادات</p>
              </div>
              <p className="text-2xl font-bold text-green-700">{fmt(data.revenue.total)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <p className="text-xs text-slate-500">إجمالي المصروفات (شامل تكلفة البضاعة)</p>
              </div>
              <p className="text-2xl font-bold text-rose-600">{fmt(data.cogs.total + data.operatingExpenses.total)}</p>
            </div>
            <div className={`rounded-xl border shadow-sm p-5 ${data.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {data.netProfit > 0
                  ? <TrendingUp className="w-4 h-4 text-green-600" />
                  : data.netProfit < 0
                  ? <TrendingDown className="w-4 h-4 text-red-600" />
                  : <Minus className="w-4 h-4 text-slate-500" />}
                <p className={`text-xs ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {data.netProfit >= 0 ? 'صافي الربح' : 'صافي الخسارة'}
                </p>
              </div>
              <p className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(data.netProfit)}
              </p>
            </div>
          </div>

          {/* Print title */}
          <div className="hidden print:block mb-6 text-center">
            <h1 className="text-xl font-bold">قائمة الدخل (الأرباح والخسائر)</h1>
            <p className="text-sm text-slate-600 mt-1">
              من {fmtDate(data.period.from)} إلى {fmtDate(data.period.to)}
            </p>
          </div>

          {/* P&L Statement table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">البيان</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">المبلغ (ج.م)</th>
                </tr>
              </thead>
              <tbody>
                {/* Revenue section */}
                <tr className="bg-blue-50">
                  <td colSpan={2} className="px-6 py-2 text-xs font-bold text-blue-700 uppercase tracking-wide">الإيرادات</td>
                </tr>
                {data.revenue.lines.length === 0
                  ? <tr><td colSpan={2} className="px-6 py-2 text-sm text-slate-400 italic text-center">لا توجد إيرادات في هذه الفترة</td></tr>
                  : data.revenue.lines.map(l =>
                      <SectionRow key={l.code} label={`${l.nameAr} (${l.code})`} amount={l.amount} indent />
                    )
                }
                <SectionRow label="إجمالي الإيرادات" amount={data.revenue.total} bold />

                {/* COGS section */}
                <tr className="bg-orange-50">
                  <td colSpan={2} className="px-6 py-2 text-xs font-bold text-orange-700 uppercase tracking-wide">تكلفة البضاعة المباعة</td>
                </tr>
                {data.cogs.lines.length === 0
                  ? <tr><td colSpan={2} className="px-6 py-2 text-sm text-slate-400 italic text-center">لا توجد تكاليف مباشرة</td></tr>
                  : data.cogs.lines.map(l =>
                      <SectionRow key={l.code} label={`${l.nameAr} (${l.code})`} amount={l.amount} indent />
                    )
                }
                <SectionRow label="إجمالي التكلفة المباشرة" amount={data.cogs.total} bold />

                {/* Gross profit */}
                <SectionRow
                  label="مجمل الربح"
                  amount={data.grossProfit}
                  bold
                  highlight={data.grossProfit >= 0 ? 'profit' : 'loss'}
                />

                {/* Operating expenses */}
                <tr className="bg-rose-50">
                  <td colSpan={2} className="px-6 py-2 text-xs font-bold text-rose-700 uppercase tracking-wide">المصروفات التشغيلية</td>
                </tr>
                {data.operatingExpenses.lines.length === 0
                  ? <tr><td colSpan={2} className="px-6 py-2 text-sm text-slate-400 italic text-center">لا توجد مصروفات تشغيلية</td></tr>
                  : data.operatingExpenses.lines.map(l =>
                      <SectionRow key={l.code} label={`${l.nameAr} (${l.code})`} amount={l.amount} indent />
                    )
                }
                <SectionRow label="إجمالي المصروفات التشغيلية" amount={data.operatingExpenses.total} bold />

                {/* Net profit — highlighted row */}
                <tr className={`border-t-2 border-slate-300 ${data.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <td className="px-6 py-4 text-base font-bold text-slate-900">
                    {data.netProfit >= 0 ? '✓ صافي الربح' : '✗ صافي الخسارة'}
                  </td>
                  <td className={`px-6 py-4 text-base font-bold text-left tabular-nums ${data.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {fmt(data.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Margin analysis */}
          {data.revenue.total > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-5 no-print">
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-500 mb-1">هامش المجمل</p>
                <p className="text-xl font-bold text-slate-900">
                  {((data.grossProfit / data.revenue.total) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-500 mb-1">هامش الربح الصافي</p>
                <p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {((data.netProfit / data.revenue.total) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
        }
      `}</style>
    </div>
  );
}
