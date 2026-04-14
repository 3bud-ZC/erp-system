'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, TrendingUp, TrendingDown, FileText, ArrowUpRight, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export default function AccountingPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch('/api/journal-entries', { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setEntries(Array.isArray(d) ? d : []); })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const last30 = entries.filter((e) => {
    const d = new Date(e.date || e.createdAt);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return d >= cutoff;
  });

  const totalDebit = last30.reduce((sum, e) => {
    const lineDebit = e.lines?.reduce((s: number, l: any) => s + (l.debit || 0), 0) || 0;
    return sum + lineDebit;
  }, 0);

  const totalCredit = last30.reduce((sum, e) => {
    const lineCredit = e.lines?.reduce((s: number, l: any) => s + (l.credit || 0), 0) || 0;
    return sum + lineCredit;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">المحاسبة</h1>
        <p className="text-gray-500 text-sm mt-1">نظرة عامة على القيود المحاسبية</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-500 text-sm">قيود آخر 30 يوم</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : last30.length}
              </p>
            </div>
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي المدين</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : formatCurrency(totalDebit)}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي الدائن</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : formatCurrency(totalCredit)}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/accounting/journal"
          className="flex items-center gap-3 bg-purple-600 text-white rounded-xl p-5 hover:bg-purple-700 transition-colors"
        >
          <BookOpen className="w-6 h-6" />
          <div className="flex-1">
            <p className="font-bold">دفتر القيود اليومية</p>
            <p className="text-sm text-purple-200">عرض وإدارة القيود المحاسبية</p>
          </div>
          <ArrowUpRight className="w-5 h-5" />
        </Link>

        <Link
          href="/dashboard/sales/reports"
          className="flex items-center gap-3 bg-blue-600 text-white rounded-xl p-5 hover:bg-blue-700 transition-colors"
        >
          <TrendingUp className="w-6 h-6" />
          <div className="flex-1">
            <p className="font-bold">تقارير المبيعات والمشتريات</p>
            <p className="text-sm text-blue-200">ملخص الأداء المالي</p>
          </div>
          <ArrowUpRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Recent Entries */}
      {!loading && last30.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">آخر القيود (30 يوم)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="py-2 px-3 font-semibold text-gray-700">رقم القيد</th>
                  <th className="py-2 px-3 font-semibold text-gray-700">التاريخ</th>
                  <th className="py-2 px-3 font-semibold text-gray-700">الوصف</th>
                  <th className="py-2 px-3 font-semibold text-gray-700">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {last30.slice(0, 10).map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{entry.entryNumber || entry.id?.slice(0, 8)}</td>
                    <td className="py-2 px-3 text-gray-600">
                      {new Date(entry.date || entry.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-2 px-3 text-gray-600">{entry.description || '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        entry.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {entry.status === 'posted' ? 'مرحّل' : 'مسودة'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-center">
            <Link href="/dashboard/accounting/journal" className="text-sm text-purple-600 hover:underline">
              عرض جميع القيود &larr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
