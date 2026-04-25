'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Printer, CheckCircle, XCircle } from 'lucide-react';

interface SheetLine {
  code: string;
  nameAr: string;
  amount: number;
  subType?: string | null;
}

interface BSData {
  asOfDate: string;
  assets:      { lines: SheetLine[]; total: number };
  liabilities: { lines: SheetLine[]; total: number };
  equity:      { lines: SheetLine[]; netIncome: number; total: number; totalWithIncome: number };
  summary: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
    difference: number;
  };
}

function fmt(v: number) {
  return Math.abs(v).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <tr className={color}>
      <td colSpan={2} className="px-6 py-2 text-xs font-bold uppercase tracking-wide">{label}</td>
    </tr>
  );
}

function LineRow({ line }: { line: SheetLine }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
      <td className="px-6 py-2.5 pr-10 text-sm text-slate-700">
        {line.nameAr}
        <span className="text-slate-400 mr-2 font-mono text-xs">({line.code})</span>
      </td>
      <td className={`px-6 py-2.5 text-sm text-left tabular-nums ${line.amount < 0 ? 'text-red-600' : 'text-slate-800'}`}>
        {Math.abs(line.amount) < 0.01 ? '—' : fmt(line.amount)}
        {line.amount < 0 && <span className="text-xs mr-1 text-red-400">(مدين)</span>}
      </td>
    </tr>
  );
}

function TotalRow({ label, amount, highlight }: { label: string; amount: number; highlight?: boolean }) {
  return (
    <tr className={`border-t-2 border-slate-300 ${highlight ? 'bg-slate-100' : 'bg-slate-50'}`}>
      <td className="px-6 py-3 text-sm font-bold text-slate-900">{label}</td>
      <td className={`px-6 py-3 text-sm font-bold text-left tabular-nums ${highlight ? 'text-slate-900 text-base' : 'text-slate-800'}`}>
        {fmt(amount)}
      </td>
    </tr>
  );
}

export default function BalanceSheetPage() {
  const [data, setData]       = useState<BSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/reports/balance-sheet?asOfDate=${asOfDate}`, { credentials: 'include' });
      const j   = await res.json();
      if (!j.success) throw new Error(j.message || 'فشل تحميل الميزانية');
      setData(j.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الميزانية العمومية</h1>
          {data && (
            <p className="text-sm text-slate-500 mt-0.5">
              حتى تاريخ: {fmtDate(data.asOfDate)}
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
          <label className="text-sm text-slate-600 whitespace-nowrap">حتى تاريخ:</label>
          <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={load}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          عرض الميزانية
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="animate-pulse">
          <div className="grid grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-5">
                <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
                <div className="h-8 w-32 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
                  <div className="h-4 w-16 bg-slate-200 rounded" />
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3 border-b border-slate-100 last:border-0">
                    <div className="h-4 w-36 bg-slate-100 rounded" />
                    <div className="h-4 w-24 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : !data ? null : (
        <>
          {/* Balance check banner */}
          <div className={`mb-5 px-5 py-3.5 rounded-xl flex items-center gap-3 text-sm font-medium ${
            data.summary.isBalanced
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {data.summary.isBalanced
              ? <CheckCircle className="w-5 h-5 shrink-0" />
              : <XCircle className="w-5 h-5 shrink-0" />}
            {data.summary.isBalanced
              ? 'الميزانية متوازنة — الأصول = الخصوم + حقوق الملكية'
              : `الميزانية غير متوازنة — الفرق: ${fmt(Math.abs(data.summary.difference))}`}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4 mb-6 no-print">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-xs text-blue-600 mb-1">إجمالي الأصول</p>
              <p className="text-2xl font-bold text-blue-800">{fmt(data.summary.totalAssets)}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
              <p className="text-xs text-orange-600 mb-1">إجمالي الخصوم</p>
              <p className="text-2xl font-bold text-orange-800">{fmt(data.summary.totalLiabilities)}</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
              <p className="text-xs text-purple-600 mb-1">إجمالي حقوق الملكية</p>
              <p className="text-2xl font-bold text-purple-800">{fmt(data.summary.totalEquity)}</p>
            </div>
          </div>

          {/* Print title */}
          <div className="hidden print:block mb-6 text-center">
            <h1 className="text-xl font-bold">الميزانية العمومية</h1>
            <p className="text-sm text-slate-600 mt-1">حتى تاريخ: {fmtDate(data.asOfDate)}</p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT: Assets */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th colSpan={2} className="px-6 py-3 text-right text-sm font-bold text-blue-700">الأصول</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Current Assets */}
                  {data.assets.lines.filter(l => ['Cash', 'Bank', 'Receivable', 'Inventory'].includes(l.subType || '')).length > 0 && (
                    <SectionHeader label="الأصول المتداولة" color="bg-blue-50 text-blue-700" />
                  )}
                  {data.assets.lines
                    .filter(l => ['Cash', 'Bank', 'Receivable', 'Inventory'].includes(l.subType || ''))
                    .map(l => <LineRow key={l.code} line={l} />)}

                  {/* Fixed Assets */}
                  {data.assets.lines.filter(l => !['Cash', 'Bank', 'Receivable', 'Inventory'].includes(l.subType || '') && l.subType !== 'WIP').length > 0 && (
                    <SectionHeader label="الأصول الثابتة" color="bg-blue-50/60 text-blue-600" />
                  )}
                  {data.assets.lines
                    .filter(l => !['Cash', 'Bank', 'Receivable', 'Inventory'].includes(l.subType || '') && l.subType !== 'WIP')
                    .map(l => <LineRow key={l.code} line={l} />)}

                  {/* WIP Assets */}
                  {data.assets.lines.filter(l => l.subType === 'WIP').map(l => <LineRow key={l.code} line={l} />)}

                  {/* Show all assets if no subtype categorization worked */}
                  {data.assets.lines.filter(l => !l.subType).map(l => <LineRow key={l.code} line={l} />)}

                  <TotalRow label="إجمالي الأصول" amount={data.assets.total} highlight />
                </tbody>
              </table>
            </div>

            {/* RIGHT: Liabilities + Equity */}
            <div className="space-y-5">
              {/* Liabilities */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th colSpan={2} className="px-6 py-3 text-right text-sm font-bold text-orange-700">الخصوم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.liabilities.lines.filter(l => l.subType === 'Payable').length > 0 && (
                      <SectionHeader label="خصوم متداولة" color="bg-orange-50 text-orange-700" />
                    )}
                    {data.liabilities.lines.filter(l => l.subType === 'Payable').map(l => <LineRow key={l.code} line={l} />)}
                    {data.liabilities.lines.filter(l => l.subType !== 'Payable').map(l => <LineRow key={l.code} line={l} />)}
                    {data.liabilities.lines.length === 0 && (
                      <tr><td colSpan={2} className="px-6 py-4 text-sm text-slate-400 text-center">لا توجد خصوم</td></tr>
                    )}
                    <TotalRow label="إجمالي الخصوم" amount={data.liabilities.total} highlight />
                  </tbody>
                </table>
              </div>

              {/* Equity */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th colSpan={2} className="px-6 py-3 text-right text-sm font-bold text-purple-700">حقوق الملكية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.equity.lines.map(l => <LineRow key={l.code} line={l} />)}

                    {/* Net income row */}
                    <tr className={`border-b border-slate-100 hover:bg-slate-50/50`}>
                      <td className="px-6 py-2.5 pr-10 text-sm text-slate-700">
                        {data.equity.netIncome >= 0 ? 'صافي ربح الفترة' : 'صافي خسارة الفترة'}
                        <span className="text-slate-400 mr-2 text-xs">(من قائمة الدخل)</span>
                      </td>
                      <td className={`px-6 py-2.5 text-sm text-left tabular-nums font-medium ${data.equity.netIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {Math.abs(data.equity.netIncome) < 0.01 ? '—' : fmt(data.equity.netIncome)}
                      </td>
                    </tr>

                    <TotalRow label="إجمالي حقوق الملكية" amount={data.equity.totalWithIncome} highlight />
                  </tbody>
                </table>
              </div>

              {/* Final balance check row */}
              <div className={`rounded-xl border-2 p-4 ${
                data.summary.isBalanced ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">إجمالي الخصوم + حقوق الملكية</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {fmt(data.summary.totalLiabilitiesAndEquity)}
                  </span>
                </div>
                {!data.summary.isBalanced && (
                  <p className="text-xs text-red-600 mt-1">
                    فرق: {fmt(Math.abs(data.summary.difference))} — تحقق من القيود المحاسبية
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Equation verification */}
          <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-600 no-print">
            <span className="font-medium">التحقق من معادلة المحاسبة: </span>
            الأصول ({fmt(data.summary.totalAssets)})
            {' = '}
            الخصوم ({fmt(data.summary.totalLiabilities)})
            {' + '}
            حقوق الملكية ({fmt(data.equity.totalWithIncome)})
            {' = '}
            <span className={data.summary.isBalanced ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
              {fmt(data.summary.totalLiabilitiesAndEquity)}
              {data.summary.isBalanced ? ' ✓' : ' ✗'}
            </span>
          </div>
        </>
      )}

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11px; }
        }
      `}</style>
    </div>
  );
}
