'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, BookOpen } from 'lucide-react';

interface AccountRow {
  accountId:   string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit:       number;
  credit:      number;
  balance:     number;
}

function formatEGP(v: number) {
  if (!v) return '—';
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

const typeLabels: Record<string, string> = {
  Asset:     'أصول',
  Liability: 'خصوم',
  Equity:    'حقوق ملكية',
  Revenue:   'إيرادات',
  Expense:   'مصروفات',
};

export default function TrialBalancePage() {
  const [rows, setRows]     = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [asOfDate] = useState(() => new Date().toISOString().split('T')[0]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Fetch accounts (includes per-account debit/credit from posted entries + account IDs)
      const accRes = await fetch('/api/accounts', { credentials: 'include' });
      const accJson = await accRes.json();
      if (!accJson.success) throw new Error(accJson.message || 'فشل تحميل الحسابات');

      const accounts: any[] = accJson.data ?? [];

      // Only show accounts that have activity
      const rows: AccountRow[] = accounts
        .filter(a => a.totalDebit > 0 || a.totalCredit > 0)
        .map(a => ({
          accountId:   a.id,
          accountCode: a.code,
          accountName: a.nameAr,
          accountType: a.type,
          debit:       a.totalDebit,
          credit:      a.totalCredit,
          balance:     a.totalDebit - a.totalCredit,
        }));

      setRows(rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode)));
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totalDebit  = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ميزان المراجعة</h1>
          <p className="text-sm text-slate-500 mt-0.5">حتى تاريخ: {new Date(asOfDate).toLocaleDateString('ar-EG')}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/accounting/accounts"
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700"
          >
            <BookOpen className="w-4 h-4" />
            دليل الحسابات
          </a>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm text-slate-700">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-pulse">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex gap-6">
            {['w-20', 'w-40', 'w-20', 'w-32', 'w-32', 'w-32'].map((w, i) => (
              <div key={i} className={`${w} h-3.5 bg-slate-200 rounded`} />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 border-b border-slate-100 flex gap-6 items-center last:border-0">
              <div className="w-20 h-4 bg-slate-100 rounded" />
              <div className="w-40 h-4 bg-slate-100 rounded" />
              <div className="w-20 h-4 bg-slate-100 rounded" />
              <div className="w-32 h-4 bg-slate-100 rounded" />
              <div className="w-32 h-4 bg-slate-100 rounded" />
              <div className="w-32 h-4 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-16 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">لا توجد قيود محاسبية مرحَّلة حتى الآن</p>
          <p className="text-slate-400 text-sm mt-1">ستظهر الحسابات هنا بعد إنشاء فواتير أو دفعات</p>
        </div>
      ) : (
        <>
          {/* Balance status */}
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${isBalanced ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            <span className={`w-2 h-2 rounded-full ${isBalanced ? 'bg-green-500' : 'bg-red-500'}`} />
            {isBalanced
              ? 'الميزان متوازن — مجموع المدين يساوي مجموع الدائن'
              : 'تحذير: الميزان غير متوازن — تحقق من القيود المحاسبية'}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">رمز الحساب</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">اسم الحساب</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">النوع</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">مدين</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">دائن</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => (
                  <tr key={row.accountCode} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-mono text-slate-500">{row.accountCode}</td>
                    <td className="px-5 py-3 text-sm">
                      <a
                        href={`/accounting/ledger/${row.accountId}`}
                        className="font-medium text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 group"
                      >
                        {row.accountName}
                        <BookOpen className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">
                      {typeLabels[row.accountType] || row.accountType || '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-left tabular-nums">
                      {row.debit > 0 ? formatEGP(row.debit) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-left tabular-nums">
                      {row.credit > 0 ? formatEGP(row.credit) : '—'}
                    </td>
                    <td className={`px-5 py-3 text-sm font-semibold text-left tabular-nums ${row.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                      {formatEGP(Math.abs(row.balance))}{row.balance < 0 ? ' (دائن)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="px-5 py-4 text-sm font-bold text-slate-900">الإجمالي</td>
                  <td className="px-5 py-4 text-sm font-bold text-slate-900 text-left tabular-nums">{formatEGP(totalDebit)}</td>
                  <td className="px-5 py-4 text-sm font-bold text-slate-900 text-left tabular-nums">{formatEGP(totalCredit)}</td>
                  <td className={`px-5 py-4 text-sm font-bold text-left tabular-nums ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>
                    {formatEGP(Math.abs(totalDebit - totalCredit))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
