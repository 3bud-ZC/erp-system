'use client';

import { useEffect, useState } from 'react';
import { Plus, Eye, Edit } from 'lucide-react';
import Link from 'next/link';

interface Customer {
  id: string;
  nameAr: string;
  nameEn?: string;
  email?: string;
  phone?: string;
  creditLimit?: number;
  balance?: number;
}

function formatSAR(amount?: number): string {
  if (!amount) return '—';
  return `${amount.toLocaleString('ar-SA')} ر.س`;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch('/api/customers', { credentials: 'include' });
        const json = await res.json();
        if (json.success) {
          setCustomers(json.data ?? []);
        } else {
          setError(json.message || 'فشل تحميل العملاء');
        }
      } catch {
        setError('تعذر الاتصال بالخادم');
      } finally {
        setLoading(false);
      }
    }
    loadCustomers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-slate-500">جاري تحميل العملاء…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">العملاء</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          إضافة عميل
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
          لا يوجد عملاء حتى الآن
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">الاسم</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">البريد الإلكتروني</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">الهاتف</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">حد الائتمان</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">الرصيد</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{c.nameAr}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{c.email || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{c.phone || '—'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{formatSAR(c.creditLimit)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{formatSAR(c.balance)}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/customers/${c.id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="عرض"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="تعديل"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
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
