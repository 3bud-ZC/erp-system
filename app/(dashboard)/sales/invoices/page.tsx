'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customer?: { nameAr: string };
  date?: string;
  createdAt: string;
  total: number;
  grandTotal?: number;
  status: string;
  paymentStatus?: string;
}

function formatSAR(v?: number) {
  if (v == null) return '—';
  return `${v.toLocaleString('ar-SA')} ر.س`;
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA');
}

const statusLabels: Record<string, { label: string; cls: string }> = {
  paid:      { label: 'مدفوعة',    cls: 'bg-green-50 text-green-700' },
  pending:   { label: 'معلقة',     cls: 'bg-yellow-50 text-yellow-700' },
  completed: { label: 'مكتملة',    cls: 'bg-blue-50 text-blue-700' },
  cancelled: { label: 'ملغاة',     cls: 'bg-red-50 text-red-600' },
  draft:     { label: 'مسودة',     cls: 'bg-slate-100 text-slate-600' },
};

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sales-invoices', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) setInvoices(j.data ?? []);
        else setError(j.message || 'فشل تحميل الفواتير');
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-slate-500">جاري تحميل فواتير المبيعات…</div>
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
        <h1 className="text-2xl font-bold text-slate-900">فواتير المبيعات</h1>
        <Link
          href="/sales/invoices/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          فاتورة جديدة
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
          لا توجد فواتير مبيعات حتى الآن
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">رقم الفاتورة</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">العميل</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">التاريخ</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">المجموع</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الإجمالي مع الضريبة</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => {
                const st = statusLabels[inv.status] ?? statusLabels[inv.paymentStatus ?? ''] ?? { label: inv.status, cls: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-semibold text-blue-600">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-sm text-slate-800">{inv.customer?.nameAr ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(inv.date ?? inv.createdAt)}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{formatSAR(inv.total)}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">{formatSAR(inv.grandTotal ?? inv.total)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
