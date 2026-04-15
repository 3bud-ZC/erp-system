'use client';

import { useState, useEffect } from 'react';
import { FileText, Loader, Eye } from 'lucide-react';

interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  referenceType: string;
  totalDebit: number;
  totalCredit: number;
  isPosted: boolean;
  lines: Array<{
    id: string;
    accountCode: string;
    account: { nameAr: string };
    debit: number;
    credit: number;
  }>;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
  });

  const loadEntries = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/journal-entries?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch journal entries');
      }
      const data = await response.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">القيود اليومية</h1>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">من التاريخ</label>
          <input
            type="date"
            value={dateRange.fromDate}
            onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">إلى التاريخ</label>
          <input
            type="date"
            value={dateRange.toDate}
            onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">لا توجد قيود يومية للفترة المحددة</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-lg shadow">
              <button
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50"
              >
                <div className="text-left flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{entry.entryNumber}</span>
                    <span className="text-sm text-gray-600">{new Date(entry.entryDate).toLocaleDateString('ar-SA')}</span>
                    <span className={`text-xs px-2 py-1 rounded ${entry.isPosted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {entry.isPosted ? 'مرسلة' : 'مسودة'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{entry.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">مدين: {(Number(entry.totalDebit) || 0).toFixed(2)} ج.م</p>
                  <p className="text-sm font-medium">دائن: {(Number(entry.totalCredit) || 0).toFixed(2)} ج.م</p>
                </div>
                <Eye className="w-5 h-5 ml-4 text-gray-400" />
              </button>

              {expandedId === entry.id && (
                <div className="border-t px-6 py-4 bg-gray-50">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-right py-2">الحساب</th>
                        <th className="text-right py-2">مدين</th>
                        <th className="text-right py-2">دائن</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((line) => (
                        <tr key={line.id} className="border-b">
                          <td className="py-2">{line.account?.nameAr || line.accountCode || '-'}</td>
                          <td className="text-right">{Number(line.debit) > 0 ? (Number(line.debit) || 0).toFixed(2) : '-'} ج.م</td>
                          <td className="text-right">{Number(line.credit) > 0 ? (Number(line.credit) || 0).toFixed(2) : '-'} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
