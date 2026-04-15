'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Users,
  FileText,
  ArrowUpRight,
  BarChart3,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

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

export default function SalesReportsPage() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportData, setReportData] = useState({
    totalSalesRevenue: 0,
    totalPurchasesSpent: 0,
    totalExpenses: 0,
    totalInvoicesCount: 0,
    lowStockProducts: 0,
    averageOrderValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generateReport = async () => {
    try {
      setLoading(true);
      setError(null);

      let salesInvoices: any[] = [];
      let purchaseInvoices: any[] = [];
      let expenses: any[] = [];
      let products: any[] = [];

      const extract = (d: any): any[] => Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
      await Promise.allSettled([
        fetch('/api/sales-invoices').then(r => r.ok ? r.json() : []).then(d => { salesInvoices = extract(d); }),
        fetch('/api/purchase-invoices').then(r => r.ok ? r.json() : []).then(d => { purchaseInvoices = extract(d); }),
        fetch('/api/expenses').then(r => r.ok ? r.json() : []).then(d => { expenses = extract(d); }),
        fetch('/api/products').then(r => r.ok ? r.json() : []).then(d => { products = extract(d); }),
      ]);

      // Parse dates for filtering
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59, 999);

      // Filter by date range
      const filteredSales = salesInvoices.filter((inv: any) => {
        const invDate = new Date(inv.date || inv.createdAt);
        return invDate >= startDate && invDate <= endDate;
      });

      const filteredPurchases = purchaseInvoices.filter((inv: any) => {
        const invDate = new Date(inv.date || inv.createdAt);
        return invDate >= startDate && invDate <= endDate;
      });

      const filteredExpenses = expenses.filter((exp: any) => {
        const expDate = new Date(exp.date || exp.createdAt);
        return expDate >= startDate && expDate <= endDate;
      });

      // Calculate metrics - ensure proper price field handling
      const totalSalesRevenue = filteredSales.reduce((sum: number, inv: any) => {
        if (inv.total) return sum + Number(inv.total);
        const invTotal =
          inv.items?.reduce((itemSum: number, item: any) => {
            const price = item.price || item.unitPrice || 0;
            return itemSum + (item.quantity || 0) * price;
          }, 0) || 0;
        return sum + invTotal;
      }, 0);

      const totalPurchasesSpent = filteredPurchases.reduce((sum: number, inv: any) => {
        if (inv.total) return sum + Number(inv.total);
        const invTotal =
          inv.items?.reduce((itemSum: number, item: any) => {
            const price = item.price || item.unitPrice || 0;
            return itemSum + (item.quantity || 0) * price;
          }, 0) || 0;
        return sum + invTotal;
      }, 0);

      const totalExpenses = filteredExpenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0);

      const lowStockCount = products.filter((p: any) => p.stock <= (p.minStock || 0)).length;

      const averageOrderValue = filteredSales.length > 0 ? totalSalesRevenue / filteredSales.length : 0;

      setReportData({
        totalSalesRevenue,
        totalPurchasesSpent,
        totalExpenses,
        totalInvoicesCount: filteredSales.length,
        lowStockProducts: lowStockCount,
        averageOrderValue,
      });
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err instanceof Error ? err.message : 'فشل في إنشاء التقرير');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-green-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600">جاري إعداد التقارير...</p>
        </div>
      </div>
    );
  }

  const profit = reportData.totalSalesRevenue - reportData.totalPurchasesSpent - reportData.totalExpenses;
  const profitMargin =
    reportData.totalSalesRevenue > 0 ? (profit / reportData.totalSalesRevenue) * 100 : 0;
  const salesToPurchaseRatio =
    reportData.totalPurchasesSpent > 0
      ? reportData.totalSalesRevenue / reportData.totalPurchasesSpent
      : 0;
  const opexRatio =
    reportData.totalSalesRevenue > 0
      ? (reportData.totalExpenses / reportData.totalSalesRevenue) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">تقارير المبيعات والمشتريات</h1>
          <p className="text-gray-500 text-sm mt-1">ملخص أداء المبيعات والمشتريات والمصروفات</p>
        </div>
        <button
          onClick={generateReport}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
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
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">إلى التاريخ</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
            />
          </div>
          <div className="flex items-end">
            <div className="bg-gray-50 px-4 py-2 rounded-lg text-sm text-gray-600">
              <Calendar className="w-4 h-4 inline ml-1" />
              الفترة المحددة
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="إجمالي المبيعات"
          value={formatCurrency(reportData.totalSalesRevenue)}
          subtitle="إيرادات الفترة"
          icon={DollarSign}
          color="bg-green-500"
        />
        <StatCard
          title="إجمالي المشتريات"
          value={formatCurrency(reportData.totalPurchasesSpent)}
          subtitle="تكاليف الفترة"
          icon={ShoppingCart}
          color="bg-blue-500"
        />
        <StatCard
          title="المصروفات التشغيلية"
          value={formatCurrency(reportData.totalExpenses)}
          subtitle="OPEX"
          icon={TrendingUp}
          color="bg-orange-500"
        />
        <StatCard
          title="عدد فواتير البيع"
          value={reportData.totalInvoicesCount.toString()}
          subtitle="فاتورة"
          icon={FileText}
          color="bg-purple-500"
        />
        <StatCard
          title="متوسط قيمة الفاتورة"
          value={formatCurrency(reportData.averageOrderValue)}
          subtitle="لكل فاتورة"
          icon={BarChart3}
          color="bg-cyan-500"
        />
        <StatCard
          title="مخزون منخفض"
          value={reportData.lowStockProducts.toString()}
          subtitle="منتج"
          icon={Package}
          color="bg-red-500"
        />
      </div>

      {/* Financial Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">ملخص الأداء المالي</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className={`p-4 rounded-xl ${profit >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
          >
            <p className="text-gray-600 text-sm mb-1">الربح / الخسارة الصافية</p>
            <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(profit)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              المبيعات - المشتريات - المصروفات
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-gray-600 text-sm mb-1">نسبة المبيعات للمشتريات</p>
            <p className="text-2xl font-bold text-blue-700">{salesToPurchaseRatio.toFixed(2)}x</p>
            <p className="text-xs text-gray-500 mt-1">كم مرة المبيعات تفوق المشتريات</p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-gray-600 text-sm mb-1">تكاليف التشغيل / المبيعات</p>
            <p className="text-2xl font-bold text-amber-700">{opexRatio.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">نسبة المصروفات من الإيرادات</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">هامش الربح الصافي</span>
            <span className={`text-xl font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitMargin.toFixed(2)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${profitMargin >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(Math.abs(profitMargin), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/dashboard/sales/invoices"
          className="flex items-center gap-3 bg-green-600 text-white rounded-xl p-4 hover:bg-green-700 transition-colors"
        >
          <FileText className="w-5 h-5" />
          <div className="flex-1">
            <p className="font-bold">فواتير البيع</p>
          </div>
          <ArrowUpRight className="w-4 h-4" />
        </Link>
        <Link
          href="/dashboard/sales/customers"
          className="flex items-center gap-3 bg-blue-600 text-white rounded-xl p-4 hover:bg-blue-700 transition-colors"
        >
          <Users className="w-5 h-5" />
          <div className="flex-1">
            <p className="font-bold">العملاء</p>
          </div>
          <ArrowUpRight className="w-4 h-4" />
        </Link>
        <Link
          href="/dashboard/purchases/invoices"
          className="flex items-center gap-3 bg-purple-600 text-white rounded-xl p-4 hover:bg-purple-700 transition-colors"
        >
          <ShoppingCart className="w-5 h-5" />
          <div className="flex-1">
            <p className="font-bold">فواتير الشراء</p>
          </div>
          <ArrowUpRight className="w-4 h-4" />
        </Link>
        <Link
          href="/dashboard/inventory"
          className="flex items-center gap-3 bg-orange-600 text-white rounded-xl p-4 hover:bg-orange-700 transition-colors"
        >
          <Package className="w-5 h-5" />
          <div className="flex-1">
            <p className="font-bold">المخزون</p>
          </div>
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
