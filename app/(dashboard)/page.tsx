'use client';

import { useEffect, useState } from 'react';
import EnhancedCard from '@/components/EnhancedCard';
import MobileCard from '@/components/MobileCard';
import EnhancedTable from '@/components/EnhancedTable';
import MobileTable from '@/components/MobileTable';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Plus,
  FileText,
  BarChart3,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercentage, calculatePercentageChange } from '@/lib/format';

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
  lowStockDetails: Array<{ id: string; code: string; nameAr: string; stock: number; minStock: number }>;
  totalInventoryValue: number;
  recentSalesInvoices: any[];
  recentPurchaseInvoices: any[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    salesTrend: 0,
    purchasesTrend: 0,
    expensesTrend: 0,
    grossProfit: 0,
    netProfit: 0,
    profitMargin: 0,
    lowStockProducts: 0,
    lowStockDetails: [],
    totalInventoryValue: 0,
    recentSalesInvoices: [],
    recentPurchaseInvoices: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('فشل في تحميل البيانات');
      const dashboardData = await response.json();
      setData(dashboardData);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError(err instanceof Error ? err.message : 'خطأ في تحميل لوحة التحكم');
    } finally {
      setLoading(false);
    }
  };

  const TrendIcon = ({ value }: { value: number }) =>
    value >= 0 ? (
      <TrendingUp className="w-5 h-5 text-green-600" />
    ) : (
      <TrendingDown className="w-5 h-5 text-red-600" />
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <BarChart3 className="w-8 h-8 text-blue-600 mx-auto" />
          </div>
          <p className="text-gray-600">جاري تحميل لوحة التحكم...</p>
        </div>
      </div>
    );
  }

  // Main KPI Cards
  const kpiCards = [
    {
      title: 'إجمالي المبيعات',
      value: formatCurrency(data.totalSales),
      icon: <DollarSign className="w-6 h-6" />,
      color: 'green' as const,
      trend: { value: `${Math.abs(data.salesTrend).toFixed(1)}%`, isPositive: data.salesTrend >= 0 },
      trendIcon: <TrendIcon value={data.salesTrend} />,
    },
    {
      title: 'إجمالي المشتريات',
      value: formatCurrency(data.totalPurchases),
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'blue' as const,
      trend: { value: `${Math.abs(data.purchasesTrend).toFixed(1)}%`, isPositive: data.purchasesTrend >= 0 },
      trendIcon: <TrendIcon value={data.purchasesTrend} />,
    },
    {
      title: 'إجمالي المصروفات',
      value: formatCurrency(data.totalExpenses),
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'orange' as const,
      trend: { value: `${Math.abs(data.expensesTrend).toFixed(1)}%`, isPositive: data.expensesTrend <= 0 },
      trendIcon: <TrendIcon value={data.expensesTrend} />,
    },
    {
      title: 'صافي الربح',
      value: formatCurrency(data.netProfit),
      icon: <DollarSign className="w-6 h-6" />,
      color: data.netProfit >= 0 ? ('green' as const) : ('red' as const),
      trend: { value: `${data.profitMargin.toFixed(1)}%`, isPositive: data.netProfit >= 0 },
      trendIcon: <TrendIcon value={data.netProfit} />,
    },
  ];

  // Quick Action Buttons
  const quickActions = [
    { label: 'فاتورة بيع جديدة', href: '/sales/invoices', icon: FileText, color: 'green' },
    { label: 'فاتورة شراء جديدة', href: '/purchases/invoices', icon: FileText, color: 'blue' },
    { label: 'مصروف جديد', href: '/purchases/expenses', icon: Plus, color: 'orange' },
    { label: 'منتج جديد', href: '/inventory', icon: Package, color: 'purple' },
  ];

  // Recent Sales Invoices columns
  const salesColumns = [
    { key: 'id', label: 'رقم الفاتورة', render: (value: string) => value.substring(0, 8) },
    { key: 'customer', label: 'العميل', render: (value: any) => value?.nameAr || 'N/A' },
    {
      key: 'total',
      label: 'المبلغ',
      render: (value: number) => formatCurrency(value),
    },
    {
      key: 'createdAt',
      label: 'التاريخ',
      render: (value: string) => new Date(value).toLocaleDateString('ar-EG'),
    },
  ];

  // Recent Purchase Invoices columns
  const purchaseColumns = [
    { key: 'id', label: 'رقم الفاتورة', render: (value: string) => value.substring(0, 8) },
    { key: 'supplier', label: 'المورد', render: (value: any) => value?.nameAr || 'N/A' },
    {
      key: 'total',
      label: 'المبلغ',
      render: (value: number) => formatCurrency(value),
    },
    {
      key: 'createdAt',
      label: 'التاريخ',
      render: (value: string) => new Date(value).toLocaleDateString('ar-EG'),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header with Date */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl backdrop-blur-xl" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold gradient-text mb-2">لوحة التحكم</h1>
              <p className="text-gray-600/80 text-lg">
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
              className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
            >
              <Clock className="w-4 h-4" />
              <span className="font-medium">تحديث</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {kpiCards.map((card, idx) => (
          <div key={idx} className="hidden lg:block animate-slideUp" style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="card-modern p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">
                    {card.title}
                  </span>
                  <p className="text-2xl font-bold text-gray-900 mb-1">{card.value}</p>
                  <div className="flex items-center gap-1 text-sm">
                    {card.trendIcon}
                    <span className={card.trend.isPositive ? 'text-green-600' : 'text-red-600'}>
                      {card.trend.isPositive ? '+' : '-'} {card.trend.value}
                    </span>
                  </div>
                </div>
                <div
                  className={`p-4 rounded-2xl shadow-xl animate-float ${
                    card.color === 'green'
                      ? 'bg-gradient-to-br from-green-500 to-green-600'
                      : card.color === 'blue'
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                        : card.color === 'orange'
                          ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                          : 'bg-gradient-to-br from-red-500 to-red-600'
                  }`}
                >
                  <div className="text-white">{card.icon}</div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {kpiCards.map((card, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-600 mb-1">{card.title}</p>
                  <p className="text-lg font-bold text-gray-900">{card.value}</p>
                  <div className="flex items-center gap-1 text-xs mt-1">
                    {card.trendIcon}
                    <span className={card.trend.isPositive ? 'text-green-600' : 'text-red-600'}>
                      {card.trend.isPositive ? '+' : '-'} {card.trend.value}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">الإجراءات السريعة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action, idx) => {
              const Icon = action.icon;
              const colorClass = {
                green: 'bg-green-500 hover:bg-green-600',
                blue: 'bg-blue-500 hover:bg-blue-600',
                orange: 'bg-orange-500 hover:bg-orange-600',
                purple: 'bg-purple-500 hover:bg-purple-600',
              }[action.color];

              return (
                <Link
                  key={idx}
                  href={action.href}
                  className={`${colorClass} text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-lg`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-medium text-center">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">الملخص المالي</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-green-700">الإيرادات</span>
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-900">{formatCurrency(data.totalSales)}</p>
              <p className="text-xs text-green-700 mt-2">إجمالي المبيعات هذا الشهر</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-orange-700">التكاليف</span>
                <ShoppingCart className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-orange-900">
                {formatCurrency(data.totalPurchases + data.totalExpenses)}
              </p>
              <p className="text-xs text-orange-700 mt-2">مشتريات + مصروفات</p>
            </div>

            <div
              className={`bg-gradient-to-br ${
                data.netProfit >= 0
                  ? 'from-blue-50 to-blue-100 border-blue-200'
                  : 'from-red-50 to-red-100 border-red-200'
              } rounded-2xl p-6 border`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold ${data.netProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  الربح الصافي
                </span>
                <BarChart3 className={`w-5 h-5 ${data.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`} />
              </div>
              <p className={`text-3xl font-bold ${data.netProfit >= 0 ? 'text-blue-900' : 'text-red-900'}`}>
                {formatCurrency(data.netProfit)}
              </p>
              <p className={`text-xs mt-2 ${data.netProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                هامش ربح: {data.profitMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {data.lowStockProducts > 0 && (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-50/50 to-orange-50/50 rounded-3xl backdrop-blur-xl border border-red-200" />
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">
                تنبيه: {data.lowStockProducts} منتج أقل من الحد الأدنى للمخزون
              </h2>
            </div>
            <div className="bg-white rounded-lg p-4">
              <table className="w-full text-sm text-right">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="py-2 font-semibold text-gray-700">الكود</th>
                    <th className="py-2 font-semibold text-gray-700">اسم المنتج</th>
                    <th className="py-2 font-semibold text-gray-700">المخزون الحالي</th>
                    <th className="py-2 font-semibold text-gray-700">الحد الأدنى</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockDetails.map((product) => (
                    <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 font-medium">{product.code}</td>
                      <td className="py-3">{product.nameAr}</td>
                      <td className="py-3">
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded">{product.stock}</span>
                      </td>
                      <td className="py-3">{product.minStock || 10}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link
                href="/warehouse"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
              >
                <Package className="w-4 h-4" />
                اذهب إلى المخزن
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Sales Invoices */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
          <div className="relative p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">آخر فواتير البيع</h2>
            {data.recentSalesInvoices.length > 0 ? (
              <div className="hidden lg:block">
                <EnhancedTable columns={salesColumns} data={data.recentSalesInvoices} searchable={false} />
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">لا توجد فواتير بيع حديثة</p>
            )}
            <Link
              href="/sales/invoices"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
            >
              <FileText className="w-4 h-4" />
              عرض جميع فواتير البيع
            </Link>
          </div>
        </div>

        {/* Recent Purchase Invoices */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
          <div className="relative p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">آخر فواتير الشراء</h2>
            {data.recentPurchaseInvoices.length > 0 ? (
              <div className="hidden lg:block">
                <EnhancedTable columns={purchaseColumns} data={data.recentPurchaseInvoices} searchable={false} />
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">لا توجد فواتير شراء حديثة</p>
            )}
            <Link
              href="/purchases/invoices"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
            >
              <FileText className="w-4 h-4" />
              عرض جميع فواتير الشراء
            </Link>
          </div>
        </div>
      </div>

      {/* Inventory Value Summary */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-50 to-pink-50 rounded-3xl backdrop-blur-xl border border-purple-200" />
        <div className="relative p-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-purple-700 uppercase tracking-wider">القيمة الإجمالية للمخزون</span>
              <p className="text-4xl font-bold text-purple-900 mt-2">{formatCurrency(data.totalInventoryValue)}</p>
              <p className="text-sm text-purple-700 mt-2">بناءً على تكاليف المنتجات وكميات المخزون</p>
            </div>
            <Package className="w-16 h-16 text-purple-300" />
          </div>
        </div>
      </div>
    </div>
  );
}
