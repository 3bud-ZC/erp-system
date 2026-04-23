'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

interface Supplier {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  phone?: string;
  email?: string;
  creditLimit?: number;
  balance?: number;
}

function formatSAR(v?: number) {
  if (v == null) return '—';
  return `${v.toLocaleString('ar-SA')} ر.س`;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/suppliers', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) setSuppliers(j.data ?? []);
        else setError(j.message || 'فشل تحميل الموردين');
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-slate-500">جاري تحميل الموردين…</div>
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
        <h1 className="text-2xl font-bold text-slate-900">الموردون</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          إضافة مورد
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
          لا يوجد موردون حتى الآن
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الرمز</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الاسم</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الهاتف</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">البريد الإلكتروني</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">حد الائتمان</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الرصيد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-mono text-slate-600">{s.code}</td>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900">{s.nameAr}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{s.phone ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{s.email ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{formatSAR(s.creditLimit)}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{formatSAR(s.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
