'use client';

/**
 * Reports (التقارير) hub page — placeholder.
 *
 * The previous reports section was removed; this empty hub keeps the
 * sidebar link valid so we can add report pages incrementally later.
 */
import { PieChart } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">التقارير</h1>
        <p className="text-sm text-slate-500 mt-1">
          تقارير المبيعات، المشتريات، المخزون، والتقارير المالية.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center text-white shadow-md shadow-blue-500/20 mb-4">
          <PieChart className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">قسم التقارير قيد التجهيز</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          هذا القسم محجوز لتقارير المبيعات، المشتريات، المخزون، والمالية، وسيتم تفعيله قريباً.
        </p>
      </div>
    </div>
  );
}
