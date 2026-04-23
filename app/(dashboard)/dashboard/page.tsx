'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Package, DollarSign, Users, FileText, ShoppingCart, AlertTriangle } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  trend?: number;
  icon: React.ReactNode;
  color: string;
}

function KPICard({ title, value, trend, icon, color }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          {icon}
        </div>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-sm font-medium flex items-center gap-1 ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
      <p className="text-sm text-slate-500">{title}</p>
    </div>
  );
}

interface DashboardData {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  salesTrend: number;
  purchasesTrend: number;
  expensesTrend: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  lowStockProducts: number;
  lowStockDetails: any[];
  totalInventoryValue: number;
  totalProducts: number;
  recentActivities: any[];
  alerts: any[];
}

function formatEGP(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} م.ج`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)} ألف ج.م`;
  return `${amount.toLocaleString('ar-EG')} ج.م`;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard', { credentials: 'include' });
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.message || 'فشل تحميل البيانات');
        }
      } catch {
        setError('تعذر الاتصال بالخادم');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-slate-500 text-lg">جاري تحميل البيانات…</div>
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
    <div dir="rtl" className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">لوحة التحكم</h1>

      {/* Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {data.alerts.map((alert: any) => (
            <div key={alert.id} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{alert.title}:</span>
              <span>{alert.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="إجمالي المبيعات (الشهر الحالي)"
          value={formatEGP(data?.totalSales ?? 0)}
          trend={data?.salesTrend}
          icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}
          color="bg-blue-50"
        />
        <KPICard
          title="إجمالي المشتريات"
          value={formatEGP(data?.totalPurchases ?? 0)}
          trend={data?.purchasesTrend}
          icon={<DollarSign className="w-5 h-5 text-orange-600" />}
          color="bg-orange-50"
        />
        <KPICard
          title="إجمالي المصروفات"
          value={formatEGP(data?.totalExpenses ?? 0)}
          trend={data?.expensesTrend}
          icon={<FileText className="w-5 h-5 text-red-600" />}
          color="bg-red-50"
        />
        <KPICard
          title="صافي الربح"
          value={formatEGP(data?.netProfit ?? 0)}
          icon={<TrendingUp className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
        <KPICard
          title="قيمة المخزون"
          value={formatEGP(data?.totalInventoryValue ?? 0)}
          icon={<Package className="w-5 h-5 text-purple-600" />}
          color="bg-purple-50"
        />
        <KPICard
          title="إجمالي المنتجات"
          value={(data?.totalProducts ?? 0).toString()}
          icon={<Users className="w-5 h-5 text-indigo-600" />}
          color="bg-indigo-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        {data?.lowStockDetails && data.lowStockDetails.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              منتجات بمخزون منخفض
            </h2>
            <div className="space-y-3">
              {data.lowStockDetails.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 last:border-0">
                  <span className="font-medium text-slate-800">{p.nameAr}</span>
                  <span className="text-red-500 font-semibold">{p.stock} / {p.minStock ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activities */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">آخر النشاطات</h2>
          {data?.recentActivities && data.recentActivities.length > 0 ? (
            <div className="space-y-3">
              {data.recentActivities.map((activity: any) => (
                <div key={activity.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 last:border-0">
                  <div>
                    <p className="font-medium text-slate-800">{activity.title}</p>
                    <p className="text-xs text-slate-400">{activity.description}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-700">{formatEGP(activity.amount)}</p>
                    <p className="text-xs text-slate-400">{activity.date}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-6">لا توجد نشاطات حديثة</p>
          )}
        </div>
      </div>

      {/* Profit Margin Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">ملخص الربحية — الشهر الحالي</h2>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">{formatEGP(data?.grossProfit ?? 0)}</p>
            <p className="text-sm text-slate-500 mt-1">إجمالي الربح</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{formatEGP(data?.netProfit ?? 0)}</p>
            <p className="text-sm text-slate-500 mt-1">صافي الربح</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">{data?.profitMargin ?? 0}%</p>
            <p className="text-sm text-slate-500 mt-1">هامش الربح</p>
          </div>
        </div>
      </div>
    </div>
  );
}
