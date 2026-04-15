'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  Users,
  FileText,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/format';

// Stats Card Component
function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

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

  const generateReport = async () => {
    try {
      setLoading(true);
      setError(null);

      let invoices: any[] = [];
      let suppliers: any[] = [];

      const extract = (d: any): any[] => Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
      await Promise.allSettled([
        fetch('/api/purchase-invoices').then(r => r.ok ? r.json() : []).then(d => { invoices = extract(d); }),
        fetch('/api/suppliers').then(r => r.ok ? r.json() : []).then(d => { suppliers = extract(d); }),
      ]);

      const startDate = new Date(dateRange.fromDate);
      const endDate = new Date(dateRange.toDate);
      endDate.setHours(23, 59, 59, 999);

      const filtered = invoices.filter((inv: any) => {
        const d = new Date(inv.date || inv.createdAt);
        return d >= startDate && d <= endDate;
      });

      const totalPurchases = filtered.reduce((sum: number, inv: any) => {
        if (inv.total) return sum + inv.total;
        const t = inv.items?.reduce((s: number, item: any) => s + (item.quantity || 0) * (item.price || 0), 0) || 0;
        return sum + t;
      }, 0);

      const totalInvoices = filtered.length;
      const averageOrderValue = totalInvoices > 0 ? totalPurchases / totalInvoices : 0;

      // Build top suppliers map
      const supplierMap: Record<string, { name: string; total: number; invoiceCount: number }> = {};
      filtered.forEach((inv: any) => {
        const supplierId = inv.supplierId || 'unknown';
        const supplier = suppliers.find((s: any) => s.id === supplierId);
        const name = supplier?.nameAr || inv.supplier?.nameAr || supplierId;
        const invTotal = inv.total || inv.items?.reduce((s: number, item: any) => s + (item.quantity || 0) * (item.price || 0), 0) || 0;
        if (!supplierMap[supplierId]) supplierMap[supplierId] = { name, total: 0, invoiceCount: 0 };
        supplierMap[supplierId].total += invTotal;
        supplierMap[supplierId].invoiceCount += 1;
      });

      const topSuppliers = Object.values(supplierMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Build monthly trends
      const monthMap: Record<string, number> = {};
      filtered.forEach((inv: any) => {
        const d = new Date(inv.date || inv.createdAt);
        const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const invTotal = inv.total || inv.items?.reduce((s: number, item: any) => s + (item.quantity || 0) * (item.price || 0), 0) || 0;
        monthMap[key] = (monthMap[key] || 0) + invTotal;
      });
      const monthlyTrends = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, total]) => ({ month, total }));

      setReportData({ totalPurchases, averageOrderValue, totalInvoices, topSuppliers, monthlyTrends, categoryBreakdown: [] });
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err instanceof Error ? err.message : 'فشل في إنشاء التقرير');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const handleExportCSV = () => {
    try {
      const headers = ['المورد', 'إجمالي الشراء', 'عدد الفواتير'];
      const csv = [headers.join(','), ...reportData.topSuppliers.map((s) => `${s.name},${s.total},${s.invoiceCount}`)].join(
        '\n'
      );

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `تقرير-المشتريات-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (err) {
      console.error('Error exporting report:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">تقارير المشتريات</h1>
          <p className="text-gray-500 text-sm mt-1">تحليل نشاط المشتريات والموردين</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          تصدير CSV
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Date Range Filter */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">من التاريخ</label>
            <input
              type="date"
              value={dateRange.fromDate}
              onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">إلى التاريخ</label>
            <input
              type="date"
              value={dateRange.toDate}
              onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={generateReport}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'جاري التحديث...' : 'إنشاء التقرير'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="إجمالي المشتريات"
          value={formatCurrency(reportData.totalPurchases)}
          subtitle="الفترة المحددة"
          icon={DollarSign}
          color="bg-blue-500"
        />
        <StatCard
          title="عدد الفواتير"
          value={formatNumber(reportData.totalInvoices)}
          subtitle="فاتورة"
          icon={FileText}
          color="bg-green-500"
        />
        <StatCard
          title="متوسط قيمة الفاتورة"
          value={formatCurrency(reportData.averageOrderValue)}
          subtitle="لكل فاتورة"
          icon={TrendingUp}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suppliers */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900">أفضل الموردين</h2>
          </div>

          {reportData.topSuppliers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold text-gray-700">المورد</th>
                    <th className="py-2 px-3 font-semibold text-gray-700">إجمالي الشراء</th>
                    <th className="py-2 px-3 font-semibold text-gray-700">الفواتير</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.topSuppliers.map((supplier, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium">{supplier.name}</td>
                      <td className="py-3 px-3">{formatCurrency(supplier.total)}</td>
                      <td className="py-3 px-3">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                          {supplier.invoiceCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">لا توجد بيانات متاحة</p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-bold text-gray-900">توزيع الفئات</h2>
          </div>

          {reportData.categoryBreakdown.length > 0 ? (
            <div className="space-y-4">
              {reportData.categoryBreakdown.map((item, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">{item.category}</span>
                    <span className="text-sm text-gray-600">
                      {item.percentage}% - {formatCurrency(item.total)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
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
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-bold text-gray-900">الاتجاهات الشهرية</h2>
        </div>

        {reportData.monthlyTrends.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-4 py-4" style={{ minHeight: '250px' }}>
              {reportData.monthlyTrends.map((trend, idx) => {
                const maxValue = Math.max(...reportData.monthlyTrends.map((t) => t.total));
                const percentage = (trend.total / maxValue) * 100 || 0;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 min-w-[60px]">
                    <div
                      className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all hover:from-blue-600 hover:to-blue-500"
                      style={{ height: `${Math.max(percentage, 10)}%`, minHeight: '40px' }}
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

      {/* Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/purchases/invoices"
          className="flex items-center gap-3 bg-blue-600 text-white rounded-xl p-5 hover:bg-blue-700 transition-colors"
        >
          <FileText className="w-6 h-6" />
          <div>
            <h3 className="font-bold">فواتير الشراء</h3>
            <p className="text-sm text-blue-100">عرض جميع فواتير الشراء</p>
          </div>
          <ArrowUpRight className="w-5 h-5 mr-auto" />
        </Link>
        <Link
          href="/dashboard/purchases/suppliers"
          className="flex items-center gap-3 bg-green-600 text-white rounded-xl p-5 hover:bg-green-700 transition-colors"
        >
          <Users className="w-6 h-6" />
          <div>
            <h3 className="font-bold">الموردين</h3>
            <p className="text-sm text-green-100">إدارة بيانات الموردين</p>
          </div>
          <ArrowUpRight className="w-5 h-5 mr-auto" />
        </Link>
      </div>
    </div>
  );
}
