'use client';

import { useEffect, useState } from 'react';
import { Plus, Warehouse } from 'lucide-react';

interface WarehouseItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  address?: string;
  isActive?: boolean;
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/warehouses', { credentials: 'include' })
      .then(r => r.json())
      .then(j => {
        if (j.success) setWarehouses(j.data ?? []);
        else setError(j.message || 'فشل تحميل المستودعات');
      })
      .catch(() => setError('تعذر الاتصال بالخادم'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64" dir="rtl">
      <div className="text-slate-500">جاري تحميل المستودعات…</div>
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
        <h1 className="text-2xl font-bold text-slate-900">المستودعات</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          إضافة مستودع
        </button>
      </div>

      {warehouses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 text-center text-slate-400">
          لا توجد مستودعات حتى الآن
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map(w => (
            <div key={w.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:border-blue-200 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Warehouse className="w-5 h-5 text-blue-600" />
                </div>
                {w.isActive !== false ? (
                  <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">نشط</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">غير نشط</span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">{w.nameAr}</h3>
              <p className="text-xs text-slate-400 font-mono mb-2">{w.code}</p>
              {w.address && (
                <p className="text-sm text-slate-500">{w.address}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
