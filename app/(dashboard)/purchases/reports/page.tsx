'use client';

import { useState, useEffect } from 'react';
import EnhancedCard from '@/components/EnhancedCard';
import { TrendingUp, DollarSign, ShoppingCart, Calendar, Download, Filter, Loader } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';
import Link from 'next/link';

export default function PurchaseReportsPage() {
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
  });

  const [reportData, setReportData] = useState({
    totalPurchases: 0,
    averageOrderValue: 0,
    totalInvoices: 0,
    topSuppliers: [] as any[],
    monthlyTrends: [] as any[],
    categoryBreakdown: [] as any[],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    generateReport();
  }, [dateRange]);

  const generateReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
      });

      const response = await fetch(`/api/purchases/reports?${params}`);
      if (!response.ok) throw new Error('فشل في تحميل التقرير');

      const data = await response.json();
      setReportData(data);
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err instanceof Error ? err.message : 'فشل في إنشاء التقرير');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      // Create CSV content
      const headers = ['رقم الفاتورة', 'المورد', 'التاريخ', 'المبلغ'];
      const csv = [
        headers.join(','),
        ...reportData.topSuppliers.map((s) => `${s.name},${formatCurrency(s.total)}`),
      ].join('\n');

      // Create and download file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `تقرير-المشتريات-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (err) {
      console.error('Error exporting report:', err);
    }
  };

  const stats = [
    {
      title: 'إجمالي المشتريات',
      value: formatCurrency(reportData.totalPurchases),
      icon: <DollarSign className="w-6 h-6" />,
      color: 'blue' as const,
      trend: { value: 'الفترة المحددة', isPositive: true },
    },
    {
      title: 'عدد الفواتير',
      value: formatNumber(reportData.totalInvoices),
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'green' as const,
      trend: { value: 'فاتورة', isPositive: true },
    },
    {
      title: 'متوسط قيمة الفاتورة',
      value: formatCurrency(reportData.averageOrderValue),
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'purple' as const,
      trend: { value: 'لكل فاتورة', isPositive: true },
    },
  ];

  if (loading && reportData.totalPurchases === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">جاري إنشاء التقرير...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl backdrop-blur-xl" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-3">تقارير المشتريات</h1>
            <p className="text-gray-600/80 text-lg">تحليل نشاط المشتريات والموردين</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/50 hover:bg-white/70 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm border border-white/20"
          >
            <Download className="w-4 h-4" />
            <span className="font-medium">تصدير التقرير</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600">
          <p className="font-medium">خطأ: {error}</p>
        </div>
      )}

      {/* Date Range Filter */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">من التاريخ</label>
              <input
                type="date"
                value={dateRange.fromDate}
                onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">إلى التاريخ</label>
              <input
                type="date"
                value={dateRange.toDate}
                onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={generateReport}
                disabled={loading}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'جاري التحديث...' : 'إنشاء التقرير'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="hidden lg:block animate-slideUp" style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="card-modern p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-600/80 mb-2 uppercase tracking-wider">
                    {stat.title}
                  </span>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
                </div>
                <div
                  className={`p-4 rounded-2xl shadow-xl animate-float ${
                    stat.color === 'blue'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                      : stat.color === 'green'
                        ? 'bg-gradient-to-br from-green-500 to-green-600'
                        : 'bg-gradient-to-br from-purple-500 to-purple-600'
                  }`}
                >
                  <div className="text-white">{stat.icon}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top Suppliers */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">أفضل الموردين</h2>
          {reportData.topSuppliers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-gray-700">اسم المورد</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">إجمالي الشراء</th>
                    <th className="py-3 px-4 font-semibold text-gray-700">عدد الفواتير</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.topSuppliers.map((supplier, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{supplier.name}</td>
                      <td className="py-3 px-4">{formatCurrency(supplier.total)}</td>
                      <td className="py-3 px-4">{supplier.invoiceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">لا توجد بيانات متاحة</p>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">توزيع الفئات</h2>
          {reportData.categoryBreakdown.length > 0 ? (
            <div className="space-y-4">
              {reportData.categoryBreakdown.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">{item.category}</span>
                    <span className="text-sm text-gray-600">{item.percentage}% - {formatCurrency(item.total)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">لا توجد بيانات متاحة</p>
          )}
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">الاتجاهات الشهرية</h2>
          {reportData.monthlyTrends.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="flex items-end gap-4 py-8" style={{ minHeight: '300px' }}>
                {reportData.monthlyTrends.map((trend, idx) => {
                  const maxValue = Math.max(...reportData.monthlyTrends.map((t) => t.total));
                  const percentage = (trend.total / maxValue) * 100 || 0;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-gradient-to-t from-blue-500 to-blue-600 rounded-t-lg transition-all hover:from-blue-600 hover:to-blue-700"
                        style={{ height: `${percentage}%`, minHeight: '40px' }}
                        title={formatCurrency(trend.total)}
                      />
                      <span className="text-xs font-medium text-gray-600">{trend.month}</span>
                      <span className="text-xs text-gray-500">{formatCurrency(trend.total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">لا توجد بيانات متاحة</p>
          )}
        </div>
      </div>

      {/* Links to Related Pages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/purchases/invoices"
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-6 hover:shadow-lg transition-all"
        >
          <h3 className="font-bold mb-2">فواتير الشراء</h3>
          <p className="text-sm text-blue-100">عرض جميع فواتير الشراء</p>
        </Link>
        <Link
          href="/purchases/suppliers"
          className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-2xl p-6 hover:shadow-lg transition-all"
        >
          <h3 className="font-bold mb-2">الموردين</h3>
          <p className="text-sm text-purple-100">إدارة بيانات الموردين</p>
        </Link>
      </div>
    </div>
  );
}
