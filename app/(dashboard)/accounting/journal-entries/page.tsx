'use client';

import { useEffect, useState } from 'react';
import { Plus, CheckCircle, Clock } from 'lucide-react';

interface JournalEntry {
  id: string;
  entryNumber?: string;
  date?: string;
  createdAt: string;
  description?: string;
  notes?: string;
  totalDebit?: number;
  totalCredit?: number;
  isPosted?: boolean;
  status?: string;
}

function formatEGP(v?: number) {
  if (v == null) return '—';
  return `${v.toLocaleString('ar-EG')} ج.م`;
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG');
}

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/journal-entries', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          // API returns { data: { entries: [...], total, page, limit } }
          const raw = j.data;
          const arr = Array.isArray(raw) ? raw : (raw?.entries ?? raw?.data ?? []);
          setEntries(arr);
        } else {
          setError(j.message || 'فشل تحميل القيود');
        }
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-slate-500">جاري تحميل القيود المحاسبية…</div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-red-500">{error}</div>
    </div>
  );

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">القيود المحاسبية</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          قيد جديد
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
          لا توجد قيود محاسبية حتى الآن
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">رقم القيد</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">البيان</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">إجمالي المدين</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">إجمالي الدائن</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-700">{e.entryNumber ?? e.id.slice(-6)}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{formatDate(e.date ?? e.createdAt)}</td>
                  <td className="px-5 py-3 text-sm text-slate-700 max-w-xs truncate">{e.description ?? e.notes ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{formatEGP(e.totalDebit)}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{formatEGP(e.totalCredit)}</td>
                  <td className="px-5 py-3">
                    {e.isPosted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                        <CheckCircle className="w-3 h-3" /> مرحّل
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-medium">
                        <Clock className="w-3 h-3" /> مسودة
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
