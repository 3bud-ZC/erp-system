'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SalesChart from '@/components/dashboard/SalesChart';
import InventoryChart from '@/components/dashboard/InventoryChart';
import AlertsSection from '@/components/dashboard/AlertsSection';
import ActivityLog from '@/components/dashboard/ActivityLog';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  FileText,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

// Types
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
  totalProducts: number;
  totalInventoryValue: number;
  recentActivities: Activity[];
  alerts: Alert[];
  chartData: {
    labels: string[];
    sales: number[];
    purchases: number[];
  };
  inventoryData: {
    rawMaterials: number;
    finishedGoods: number;
    packaging: number;
  };
}

interface Activity {
  id: string;
  type: 'sale' | 'purchase' | 'product' | 'customer' | 'supplier' | 'production' | 'expense';
  title: string;
  description: string;
  amount?: number;
  date: string;
  status?: 'completed' | 'pending' | 'cancelled';
}

interface Alert {
  id: string;
  type: 'stock' | 'payment' | 'expiry' | 'order';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  date: string;
}

// Quick Actions
const quickActions = [
  { label: 'فاتورة بيع', href: '/dashboard/sales/invoices', icon: FileText, color: 'bg-green-500 hover:bg-green-600' },
  { label: 'فاتورة شراء', href: '/dashboard/purchases/invoices', icon: ShoppingCart, color: 'bg-blue-500 hover:bg-blue-600' },
  { label: 'عميل جديد', href: '/dashboard/sales/customers', icon: Users, color: 'bg-orange-500 hover:bg-orange-600' },
  { label: 'مورد جديد', href: '/dashboard/purchases/suppliers', icon: Users, color: 'bg-cyan-500 hover:bg-cyan-600' },
  { label: 'منتج جديد', href: '/dashboard/inventory', icon: Plus, color: 'bg-purple-500 hover:bg-purple-600' },
  { label: 'أمر إنتاج', href: '/dashboard/manufacturing/production-orders', icon: Package, color: 'bg-indigo-500 hover:bg-indigo-600' },
];

// KPICard Component
function KPICard({ 
  title, 
  value, 
  trend, 
  trendValue, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  value: string; 
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  icon: any;
  color: string;
}) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };

  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : TrendingUp;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <div className={`flex items-center gap-1 mt-2 ${trendColors[trend]}`}>
            <TrendIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{trendValue}</span>
          </div>
        </div>
        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('فشل في تحميل البيانات');
      const result = await response.json();
      
      // Ensure safe defaults for all arrays and objects
      const dashboardData: DashboardData = {
        totalSales: result.totalSales || 0,
        totalPurchases: result.totalPurchases || 0,
        totalExpenses: result.totalExpenses || 0,
        salesTrend: result.salesTrend || 0,
        purchasesTrend: result.purchasesTrend || 0,
        expensesTrend: result.expensesTrend || 0,
        grossProfit: result.grossProfit || 0,
        netProfit: result.netProfit || 0,
        profitMargin: result.profitMargin || 0,
        lowStockProducts: result.lowStockProducts || 0,
        totalProducts: result.totalProducts || 0,
        totalInventoryValue: result.totalInventoryValue || 0,
        recentActivities: result.recentActivities || [],
        alerts: result.alerts || [],
        chartData: {
          labels: result.chartData?.labels || [],
          sales: result.chartData?.sales || [],
          purchases: result.chartData?.purchases || [],
        },
        inventoryData: {
          rawMaterials: result.inventoryData?.rawMaterials || 0,
          finishedGoods: result.inventoryData?.finishedGoods || 0,
          packaging: result.inventoryData?.packaging || 0,
        },
      };
      
      setData(dashboardData);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err instanceof Error ? err.message : 'خطأ في تحميل لوحة التحكم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600">جاري تحميل لوحة التحكم...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-red-50 border border-red-200 rounded-xl p-8 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 font-medium mb-2">حدث خطأ</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Prepare alerts with low stock (with defensive checks)
  const alerts: Alert[] = [
    ...(data.lowStockProducts > 0 ? [{
      id: 'stock-1',
      type: 'stock' as const,
      title: 'مخزون منخفض',
      description: `${data.lowStockProducts} منتج أقل من الحد الأدنى`,
      severity: 'high' as const,
      date: 'الآن',
    }] : []),
    ...(data.alerts || []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString('ar-EG', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="إجمالي المبيعات"
          value={formatCurrency(data.totalSales)}
          trend={data.salesTrend >= 0 ? 'up' : 'down'}
          trendValue={`${Math.abs(data.salesTrend).toFixed(1)}%`}
          icon={DollarSign}
          color="bg-green-500"
        />
        <KPICard
          title="إجمالي المشتريات"
          value={formatCurrency(data.totalPurchases)}
          trend={data.purchasesTrend <= 0 ? 'up' : 'down'}
          trendValue={`${Math.abs(data.purchasesTrend).toFixed(1)}%`}
          icon={ShoppingCart}
          color="bg-blue-500"
        />
        <KPICard
          title="صافي الربح"
          value={formatCurrency(data.netProfit)}
          trend={data.netProfit >= 0 ? 'up' : 'down'}
          trendValue={`${data.profitMargin.toFixed(1)}%`}
          icon={TrendingUp}
          color={data.netProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}
        />
        <KPICard
          title="قيمة المخزون"
          value={formatCurrency(data.totalInventoryValue)}
          trend="neutral"
          trendValue={`${data.totalProducts} منتج`}
          icon={Package}
          color="bg-purple-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">الإجراءات السريعة</h2>
        <div className="flex flex-wrap gap-2">
          {(quickActions || []).map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className={`${action.color} text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors`}
              >
                <Icon className="w-4 h-4" />
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">أداء المبيعات والمشتريات</h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">آخر 6 أشهر</span>
          </div>
          <SalesChart data={data.chartData} />
        </div>

        {/* Inventory Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">توزيع المخزون</h2>
            <Link href="/dashboard/inventory" className="text-sm text-blue-600 hover:text-blue-700">
              عرض الكل
            </Link>
          </div>
          <InventoryChart data={data.inventoryData} />
        </div>
      </div>

      {/* Alerts & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">التنبيهات</h2>
              {alerts.length > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </div>
          </div>
          <AlertsSection alerts={alerts} />
        </div>

        {/* Activity Log */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">آخر النشاطات</h2>
            <Link href="#" className="text-sm text-blue-600 hover:text-blue-700">
              عرض الكل
            </Link>
          </div>
          <ActivityLog activities={data.recentActivities} />
        </div>
      </div>
    </div>
  );
}
