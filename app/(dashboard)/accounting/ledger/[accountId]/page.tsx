'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ArrowRight, Search, X, Printer, ChevronLeft, ChevronRight } from 'lucide-react';

interface LedgerLine {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountInfo {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  subType?: string;
  balance: number;
}

interface LedgerData {
  account: AccountInfo;
  lines: LedgerLine[];
  total: number;
  page: number;
  limit: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

const typeLabels: Record<string, string> = {
  Asset:     'أصول',
  Liability: 'خصوم',
  Equity:    'حقوق ملكية',
  Revenue:   'إيرادات',
  Expense:   'مصروفات',
};

const refLabels: Record<string, string> = {
  SalesInvoice:   'فاتورة بيع',
  PurchaseInvoice:'فاتورة شراء',
  Payment:        'دفعة',
  Manual:         'قيد يدوي',
};

function fmt(v: number) {
  if (!v && v !== 0) return '—';
  return v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function LedgerPage({ params }: { params: { accountId: string } }) {
  const { accountId } = params;

  const [data, setData]       = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const limit = 100;

  async function load(p = page) {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (fromDate) q.set('fromDate', fromDate);
      if (toDate)   q.set('toDate', toDate);
      if (search)   q.set('search', search);
      const res = await fetch(`/api/accounts/${accountId}/ledger?${q}`, { credentials: 'include' });
      const j   = await res.json();
      if (!j.success) throw new Error(j.message || 'فشل تحميل الدفتر');
      setData(j.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); setPage(1); }, [accountId, fromDate, toDate]);

  function handleSearch() { setPage(1); load(1); }

  function clearFilters() {
    setFromDate(''); setToDate(''); setSearch(''); setPage(1);
  }

  const hasFilters = fromDate || toDate || search;
  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const account = data?.account;
  const isDebitNormal = account && ['Asset', 'Expense'].includes(account.type);

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { window.location.href = '/accounting/accounts'; }}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {account ? `دفتر الأستاذ — ${account.nameAr}` : 'دفتر الأستاذ'}
            </h1>
            {account && (
              <p className="text-sm text-slate-500 mt-0.5">
                <span className="font-mono">{account.code}</span>
                {' · '}
                <span>{typeLabels[account.type] || account.type}</span>
                {account.nameEn && <span className="text-slate-400"> · {account.nameEn}</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700">
            <Printer className="w-4 h-4" />
            طباعة
          </button>
          <button onClick={() => load(page)} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm text-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4 text-sm no-print">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5 no-print">
        <input
          type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="من تاريخ"
        />
        <input
          type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="إلى تاريخ"
        />
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="بحث في البيان…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => { setSearch(''); }} className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button onClick={handleSearch}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          بحث
        </button>
        {hasFilters && (
          <button onClick={clearFilters}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            مسح
          </button>
        )}
      </div>

      {/* Summary cards */}
      {data && !loading && (
        <div className="grid grid-cols-4 gap-4 mb-5 no-print">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">إجمالي المدين</p>
            <p className="text-lg font-bold text-slate-900">{fmt(data.totalDebit)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">إجمالي الدائن</p>
            <p className="text-lg font-bold text-slate-900">{fmt(data.totalCredit)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">الرصيد الختامي</p>
            <p className={`text-lg font-bold ${data.closingBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
              {fmt(Math.abs(data.closingBalance))}
              {data.closingBalance < 0 && <span className="text-sm font-normal text-red-500"> (دائن)</span>}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-1">عدد القيود</p>
            <p className="text-lg font-bold text-slate-900">{data.total}</p>
          </div>
        </div>
      )}

      {/* Print header (only visible when printing) */}
      <div className="hidden print-only mb-6">
        <h1 className="text-xl font-bold">دفتر الأستاذ — {account?.nameAr}</h1>
        <p className="text-sm text-slate-600">
          الرمز: {account?.code} · النوع: {account && (typeLabels[account.type] || account.type)}
          {fromDate && ` · من: ${fromDate}`}
          {toDate   && ` · إلى: ${toDate}`}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">جاري تحميل دفتر الأستاذ…</div>
        </div>
      ) : !data || data.lines.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-slate-400">لا توجد حركات لهذا الحساب</p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-3 text-sm text-blue-600 hover:underline">
              مسح الفلاتر
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 w-28">التاريخ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 w-32">رقم القيد</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">البيان</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 w-24">المرجع</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-32">مدين</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-32">دائن</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-36">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Opening balance row */}
                <tr className="bg-slate-50/60">
                  <td colSpan={6} className="px-4 py-2 text-xs text-slate-500 font-medium">رصيد افتتاحي</td>
                  <td className="px-4 py-2 text-xs font-medium text-slate-600 text-left tabular-nums">0.00 ج.م</td>
                </tr>

                {data.lines.map((line, i) => (
                  <tr key={line.id} className={`hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(line.date)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500 text-xs">{line.entryNumber}</td>
                    <td className="px-4 py-3 text-slate-800 max-w-xs truncate" title={line.description}>
                      {line.description || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {line.referenceType && (
                        <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">
                          {refLabels[line.referenceType] || line.referenceType}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left tabular-nums">
                      {line.debit > 0
                        ? <span className="text-blue-700 font-medium">{fmt(line.debit)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-left tabular-nums">
                      {line.credit > 0
                        ? <span className="text-rose-600 font-medium">{fmt(line.credit)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-left tabular-nums font-semibold ${line.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                      {fmt(Math.abs(line.balance))}
                      {line.balance < 0 && <span className="text-xs font-normal text-red-400 mr-1">(د)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-sm font-bold text-slate-900">الإجمالي</td>
                  <td className="px-4 py-4 text-sm font-bold text-blue-700 text-left tabular-nums">{fmt(data.totalDebit)}</td>
                  <td className="px-4 py-4 text-sm font-bold text-rose-600 text-left tabular-nums">{fmt(data.totalCredit)}</td>
                  <td className={`px-4 py-4 text-sm font-bold text-left tabular-nums ${data.closingBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                    {fmt(Math.abs(data.closingBalance))}
                    {data.closingBalance < 0 && <span className="text-xs font-normal mr-1">(دائن)</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 no-print">
              <p className="text-sm text-slate-500">
                صفحة {page} من {totalPages} · {data.total} سطر
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); load(p); }}
                  className="p-2 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600 min-w-8 text-center">{page}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => { const p = page + 1; setPage(p); load(p); }}
                  className="p-2 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { font-size: 12px; }
          table { font-size: 11px; }
        }
        .print-only { display: none; }
      `}</style>
    </div>
  );
}
