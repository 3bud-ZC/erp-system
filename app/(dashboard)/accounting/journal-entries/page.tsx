'use client';

import { useEffect, useState } from 'react';
import { accountingApi } from '@/lib/api/accounting';
import type { JournalEntry } from '@/lib/types/accounting';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Eye, FileText, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEntries() {
      try {
        const response = await accountingApi.getJournalEntries();
        setEntries(response.data);
      } catch (error) {
        console.error('Failed to load journal entries:', error);
      } finally {
        setLoading(false);
      }
    }

    loadEntries();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading journal entries...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Journal Entries</h1>
        <Link
          href="/accounting/journal-entries/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Entry
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Entry Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Total Debit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Total Credit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                  {entry.entryNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                  {formatDate(entry.entryDate)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {entry.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                  {formatCurrency(entry.totalDebit)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                  {formatCurrency(entry.totalCredit)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {entry.isPosted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      Posted
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/accounting/journal-entries/${entry.id}`}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    {!entry.isPosted && (
                      <button
                        onClick={() => accountingApi.postJournalEntry(entry.id)}
                        className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded"
                        title="Post"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
