'use client';

import { useEffect, useState } from 'react';
import { accountingApi } from '@/lib/api/accounting';
import type { TrialBalanceReport } from '@/lib/types/accounting';
import { formatCurrency } from '@/lib/utils';
import { Download } from 'lucide-react';

export default function TrialBalancePage() {
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      try {
        const data = await accountingApi.getTrialBalance();
        setReport(data);
      } catch (error) {
        console.error('Failed to load trial balance:', error);
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading trial balance...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Failed to load trial balance</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Trial Balance</h1>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="flex justify-between text-sm text-slate-600">
            <span>As of: {new Date(report.asOfDate).toLocaleDateString()}</span>
            <span className={`font-semibold ${report.isBalanced ? 'text-green-600' : 'text-red-600'}`}>
              {report.isBalanced ? 'Balanced' : 'Unbalanced'}
            </span>
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Account Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Account Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Debit
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Credit
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {report.accounts.map((account) => (
              <tr key={account.accountCode} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                  {account.accountCode}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {account.accountName}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {account.accountType}
                </td>
                <td className="px-6 py-4 text-right text-sm text-slate-600">
                  {formatCurrency(account.debitTotal)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-slate-600">
                  {formatCurrency(account.creditTotal)}
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                  {formatCurrency(account.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={3} className="px-6 py-4 text-sm font-bold text-slate-900">
                Total
              </td>
              <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">
                {formatCurrency(report.totalDebit)}
              </td>
              <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">
                {formatCurrency(report.totalCredit)}
              </td>
              <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">
                {formatCurrency(report.totalDebit - report.totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
