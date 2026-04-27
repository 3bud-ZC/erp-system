'use client';

/**
 * Manufacturing (التصنيع) hub page — placeholder.
 *
 * Reserved for the upcoming production / BOM / work-orders modules. Kept
 * empty intentionally so the sidebar entry has a valid landing page.
 */
import { Factory } from 'lucide-react';

export default function ManufacturingPage() {
  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">التصنيع</h1>
        <p className="text-sm text-slate-500 mt-1">
          إدارة عمليات الإنتاج، أوامر التصنيع، وقوائم المواد.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center text-white shadow-md shadow-blue-500/20 mb-4">
          <Factory className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">قسم التصنيع قيد التجهيز</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          هذا القسم محجوز لإضافة أوامر التصنيع، قوائم المواد، ومراحل الإنتاج لاحقاً.
        </p>
      </div>
    </div>
  );
}
