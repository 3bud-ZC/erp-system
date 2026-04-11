'use client';

import { useState, useEffect } from 'react';
import EnhancedCard from '@/components/EnhancedCard';
import { TrendingUp, DollarSign, ShoppingCart, Package, AlertTriangle, Loader } from 'lucide-react';

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

  useEffect(() => {
    generateReport();
  }, [dateRange]);

  const generateReport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all necessary data
      const [salesRes, purchasesRes, expensesRes, productsRes] = await Promise.all([
        fetch('/api/sales-invoices'),
        fetch('/api/purchase-invoices'),
        fetch('/api/expenses'),
        fetch('/api/products'),
      ]);

      if (!salesRes.ok || !purchasesRes.ok || !expensesRes.ok || !productsRes.ok) {
        throw new Error('Failed to fetch report data');
      }

      const salesInvoices = await salesRes.json();
      const purchaseInvoices = await purchasesRes.json();
      const expenses = await expensesRes.json();
      const products = await productsRes.json();

      // Parse dates for filtering
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59, 999);

      // Filter by date range
      const filteredSales = salesInvoices.filter((inv: any) => {
        const invDate = new Date(inv.createdAt);
        return invDate >= startDate && invDate <= endDate;
      });

      const filteredPurchases = purchaseInvoices.filter((inv: any) => {
        const invDate = new Date(inv.createdAt);
        return invDate >= startDate && invDate <= endDate;
      });

      const filteredExpenses = expenses.filter((exp: any) => {
        const expDate = new Date(exp.createdAt);
        return expDate >= startDate && expDate <= endDate;
      });

      // Calculate metrics
      const totalSalesRevenue = filteredSales.reduce((sum: number, inv: any) => {
        const invTotal = inv.items?.reduce((itemSum: number, item: any) => 
          itemSum + (item.quantity * item.unitPrice), 0) || 0;
        return sum + invTotal;
      }, 0);

      const totalPurchasesSpent = filteredPurchases.reduce((sum: number, inv: any) => {
        const invTotal = inv.items?.reduce((itemSum: number, item: any) => 
          itemSum + (item.quantity * item.unitPrice), 0) || 0;
        return sum + invTotal;
      }, 0);

      const totalExpenses = filteredExpenses.reduce((sum: number, exp: any) => 
        sum + (exp.amount || 0), 0);

      const lowStockCount = products.filter((p: any) => 
        p.stock <= (p.minStock || 0)
      ).length;

      const averageOrderValue = filteredSales.length > 0 
        ? totalSalesRevenue / filteredSales.length 
        : 0;

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
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      title: 'إجمالي مبيعات الفترة',
      value: `${reportData.totalSalesRevenue.toFixed(2)} ج.م`,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'green' as const,
      trend: { value: 'هذه الفترة', isPositive: true },
    },
    {
      title: 'إجمالي المشتريات',
      value: `${reportData.totalPurchasesSpent.toFixed(2)} ج.م`,
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'blue' as const,
      trend: { value: 'هذه الفترة', isPositive: true },
    },
    {
      title: 'إجمالي المصروفات',
      value: `${reportData.totalExpenses.toFixed(2)} ج.م`,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'orange' as const,
      trend: { value: 'هذه الفترة', isPositive: false },
    },
    {
      title: 'عدد فواتير البيع',
      value: reportData.totalInvoicesCount.toString(),
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'purple' as const,
      trend: { value: 'هذه الفترة', isPositive: true },
    },
    {
      title: 'منتجات بمخزون منخفض',
      value: reportData.lowStockProducts.toString(),
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'red' as const,
      trend: { value: 'يحتاج انتباه', isPositive: false },
    },
    {
      title: 'متوسط قيمة الفاتورة',
      value: `${reportData.averageOrderValue.toFixed(2)} ج.م`,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'blue' as const,
      trend: { value: 'لكل فاتورة', isPositive: true },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">جاري إعداد التقارير...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold gradient-text mb-3">تقارير المبيعات والمشتريات</h1>
        <p className="text-gray-600/80 text-lg">ملخص أداء المبيعات والمشتريات والمصروفات</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600">
          خطأ: {error}
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
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">إلى التاريخ</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={generateReport}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:shadow-lg transition-all"
              >
                تحديث التقرير
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsCards.map((card, index) => (
          <EnhancedCard
            key={index}
            title={card.title}
            value={card.value}
            icon={card.icon}
            color={card.color}
            trend={card.trend}
          />
        ))}
      </div>

      {/* Summary Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-white/30 rounded-3xl backdrop-blur-xl" />
        <div className="relative p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">ملخص الأداء المالي</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/70 rounded-2xl p-6 border border-white/20">
              <p className="text-gray-600 text-sm mb-2">الربح الإجمالي (تقريبي)</p>
              <p className="text-3xl font-bold text-green-600">
                {(reportData.totalSalesRevenue - reportData.totalPurchasesSpent - reportData.totalExpenses).toFixed(2)} ج.م
              </p>
              <p className="text-xs text-gray-500 mt-2">هامش الربح = المبيعات - المشتريات - المصروفات</p>
            </div>
            <div className="bg-white/70 rounded-2xl p-6 border border-white/20">
              <p className="text-gray-600 text-sm mb-2">نسبة المبيعات للمشتريات</p>
              <p className="text-3xl font-bold text-blue-600">
                {reportData.totalPurchasesSpent > 0 
                  ? (reportData.totalSalesRevenue / reportData.totalPurchasesSpent).toFixed(2)
                  : '0.00'
                }x
              </p>
              <p className="text-xs text-gray-500 mt-2">كم مرة المبيعات تفوق المشتريات</p>
            </div>
            <div className="bg-white/70 rounded-2xl p-6 border border-white/20">
              <p className="text-gray-600 text-sm mb-2">تكاليف التشغيل</p>
              <p className="text-3xl font-bold text-amber-600">
                {((reportData.totalExpenses / (reportData.totalSalesRevenue || 1)) * 100).toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-2">نسبة المصروفات من المبيعات</p>
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-blue-900 text-sm">
          <strong>ملاحظة:</strong> هذه التقارير مبنية على البيانات الفعلية المسجلة في النظام. جميع الأرقام محدثة تلقائياً عند التغييرات.
        </p>
      </div>
    </div>
  );
}
