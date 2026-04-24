'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Search, X, BookOpen, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  subType?: string;
  balance: number;
  totalDebit: number;
  totalCredit: number;
}

const typeLabels: Record<string, string> = {
  Asset:     'أصول',
  Liability: 'خصوم',
  Equity:    'حقوق ملكية',
  Revenue:   'إيرادات',
  Expense:   'مصروفات',
};

const typeColors: Record<string, string> = {
  Asset:     'bg-blue-50 text-blue-700',
  Liability: 'bg-orange-50 text-orange-700',
  Equity:    'bg-purple-50 text-purple-700',
  Revenue:   'bg-green-50 text-green-700',
  Expense:   'bg-red-50 text-red-700',
};

function fmt(v: number) {
  if (!v && v !== 0) return '—';
  return v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

export default function AccountsPage() {
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accounts', { credentials: 'include' });
      const j   = await res.json();
      if (!j.success) throw new Error(j.message || 'فشل التحميل');
      setAccounts(j.data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = accounts.filter(a => {
    const matchSearch =
      !search ||
      a.nameAr.includes(search) ||
      (a.nameEn || '').toLowerCase().includes(search.toLowerCase()) ||
      a.code.includes(search);
    const matchType = !filterType || a.type === filterType;
    return matchSearch && matchType;
  });

  const totalDebit  = filtered.reduce((s, a) => s + a.totalDebit, 0);
  const totalCredit = filtered.reduce((s, a) => s + a.totalCredit, 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">دليل الحسابات</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} حساب</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm text-slate-700">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم الحساب أو الرمز…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">جميع الأنواع</option>
          <option value="Asset">أصول</option>
          <option value="Liability">خصوم</option>
          <option value="Equity">حقوق ملكية</option>
          <option value="Revenue">إيرادات</option>
          <option value="Expense">مصروفات</option>
        </select>
      </div>

      {/* Balance indicator */}
      {!loading && accounts.length > 0 && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 ${isBalanced ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          <span className={`w-2 h-2 rounded-full ${isBalanced ? 'bg-green-500' : 'bg-amber-500'}`} />
          {isBalanced
            ? `الحسابات متوازنة — إجمالي المدين = إجمالي الدائن = ${fmt(totalDebit)}`
            : `تحذير: فرق ${fmt(Math.abs(totalDebit - totalCredit))} بين المدين والدائن`}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">جاري تحميل الحسابات…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-slate-400">{accounts.length === 0 ? 'لا توجد حسابات بعد' : 'لا نتائج مطابقة للبحث'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">رمز</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">اسم الحساب</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">النوع</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">مدين</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">دائن</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">الرصيد</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">الدفتر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(acc => {
                const netBalance = acc.totalDebit - acc.totalCredit;
                const isDebitNormal = ['Asset', 'Expense'].includes(acc.type);
                const displayBalance = isDebitNormal ? netBalance : -netBalance;
                return (
                  <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-slate-500">{acc.code}</td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">
                      {acc.nameAr}
                      {acc.nameEn && <span className="block text-xs text-slate-400 font-normal">{acc.nameEn}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[acc.type] || 'bg-slate-100 text-slate-600'}`}>
                        {typeLabels[acc.type] || acc.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-left tabular-nums">
                      {acc.totalDebit > 0 ? fmt(acc.totalDebit) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-left tabular-nums">
                      {acc.totalCredit > 0 ? fmt(acc.totalCredit) : '—'}
                    </td>
                    <td className="px-5 py-3 text-left tabular-nums">
                      <span className={`text-sm font-semibold flex items-center gap-1 justify-end ${displayBalance > 0 ? 'text-slate-900' : displayBalance < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {displayBalance > 0 && <TrendingUp className="w-3 h-3 inline" />}
                        {displayBalance < 0 && <TrendingDown className="w-3 h-3 inline" />}
                        {displayBalance === 0 && <Minus className="w-3 h-3 inline" />}
                        {fmt(Math.abs(displayBalance))}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <a
                        href={`/accounting/ledger/${acc.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                      >
                        <BookOpen className="w-3 h-3" />
                        الدفتر
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td colSpan={3} className="px-5 py-4 text-sm font-bold text-slate-900">الإجمالي</td>
                <td className="px-5 py-4 text-sm font-bold text-slate-900 text-left tabular-nums">{fmt(totalDebit)}</td>
                <td className="px-5 py-4 text-sm font-bold text-slate-900 text-left tabular-nums">{fmt(totalCredit)}</td>
                <td className={`px-5 py-4 text-sm font-bold text-left tabular-nums ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>
                  {fmt(Math.abs(totalDebit - totalCredit))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
