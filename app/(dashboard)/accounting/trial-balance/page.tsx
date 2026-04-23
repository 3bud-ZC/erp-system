'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface AccountRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
}

function formatEGP(v: number) {
  if (!v) return '—';
  return `${v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

const typeLabels: Record<string, string> = {
  asset: 'أصول',
  liability: 'خصوم',
  equity: 'حقوق ملكية',
  revenue: 'إيرادات',
  expense: 'مصروفات',
  ASSET: 'أصول',
  LIABILITY: 'خصوم',
  EQUITY: 'حقوق ملكية',
  REVENUE: 'إيرادات',
  EXPENSE: 'مصروفات',
};

export default function TrialBalancePage() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate] = useState(() => new Date().toISOString().split('T')[0]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Fetch all journal entries (posted) to build trial balance
      const res = await fetch('/api/journal-entries?limit=500', { credentials: 'include' });
      const j = await res.json();
      if (!j.success) throw new Error(j.message || 'فشل تحميل القيود');

      const entries: any[] = j.data?.entries ?? [];

      // Aggregate debits/credits per account across all POSTED entries
      const map = new Map<string, AccountRow>();

      for (const entry of entries) {
        if (entry.status !== 'posted' && entry.status !== 'POSTED') continue;
        for (const line of entry.lines ?? []) {
          const code = line.accountCode || line.account?.code || '';
          const name = line.account?.nameAr || line.account?.nameEn || line.accountCode || code;
          const type = line.account?.type || '';
          if (!code) continue;

          if (!map.has(code)) {
            map.set(code, { accountCode: code, accountName: name, accountType: type, debit: 0, credit: 0, balance: 0 });
          }
          const row = map.get(code)!;
          row.debit += Number(line.debit) || 0;
          row.credit += Number(line.credit) || 0;
          row.balance = row.debit - row.credit;
        }
      }

      // Sort by account code
      const sorted = Array.from(map.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
      setRows(sorted);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ميزان المراجعة</h1>
          <p className="text-sm text-slate-500 mt-0.5">حتى تاريخ: {new Date(asOfDate).toLocaleDateString('ar-EG')}</p>
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">جاري تحميل ميزان المراجعة…</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-slate-400">لا توجد قيود محاسبية مرحَّلة حتى الآن</p>
          <p className="text-xs text-slate-300 mt-1">يظهر ميزان المراجعة فقط للقيود ذات حالة "مرحَّل"</p>
        </div>
      ) : (
        <>
          {/* Balance status */}
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${isBalanced ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            <span className={`w-2 h-2 rounded-full ${isBalanced ? 'bg-green-500' : 'bg-red-500'}`} />
            {isBalanced ? 'الميزان متوازن — مجموع المدين يساوي مجموع الدائن' : 'تحذير: الميزان غير متوازن — تحقق من القيود المحاسبية'}
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
                    <td className="px-5 py-3 text-sm font-mono text-slate-600">{row.accountCode}</td>
                    <td className="px-5 py-3 text-sm text-slate-800">{row.accountName}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{typeLabels[row.accountType] || row.accountType || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-left tabular-nums">{row.debit > 0 ? formatEGP(row.debit) : '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-left tabular-nums">{row.credit > 0 ? formatEGP(row.credit) : '—'}</td>
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
