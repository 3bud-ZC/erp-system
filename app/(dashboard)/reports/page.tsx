'use client';

import { useState, useEffect } from 'react';
import { FileText, TrendingUp, TrendingDown, Package, DollarSign, Users, ShoppingCart } from 'lucide-react';

interface ReportData {
  totalSales: number;
  totalPurchases: number;
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  lowStockCount: number;
  salesGrowth: number;
  purchaseGrowth: number;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [activeTab, setActiveTab] = useState<'financial' | 'sales' | 'purchases' | 'inventory'>('financial');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Simulate loading - replace with actual API calls
      await new Promise(resolve => setTimeout(resolve, 500));
      setData({
        totalSales: 125000,
        totalPurchases: 85000,
        totalProducts: 150,
        totalCustomers: 45,
        totalSuppliers: 28,
        lowStockCount: 12,
        salesGrowth: 15.5,
        purchaseGrowth: 8.2,
      });
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6" dir="rtl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">التقارير</h1>
          <p className="text-sm text-slate-500 mt-1">ملخص شامل لأداء النظام</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <FileText className="w-4 h-4" />
          تصدير PDF
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي المبيعات"
          value={`${data?.totalSales.toLocaleString('ar-EG')} ج.م`}
          icon={<TrendingUp className="w-5 h-5" />}
          trend={data?.salesGrowth}
          color="green"
        />
        <StatCard
          title="إجمالي المشتريات"
          value={`${data?.totalPurchases.toLocaleString('ar-EG')} ج.م`}
          icon={<TrendingDown className="w-5 h-5" />}
          trend={data?.purchaseGrowth}
          color="blue"
        />
        <StatCard
          title="المنتجات"
          value={data?.totalProducts.toString() || '0'}
          icon={<Package className="w-5 h-5" />}
          subtitle={`${data?.lowStockCount} منتج منخفض المخزون`}
          color="purple"
        />
        <StatCard
          title="العملاء والموردين"
          value={`${data?.totalCustomers} / ${data?.totalSuppliers}`}
          icon={<Users className="w-5 h-5" />}
          subtitle="عملاء / موردين"
          color="orange"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex gap-1 p-1">
            <TabButton
              active={activeTab === 'financial'}
              onClick={() => setActiveTab('financial')}
              icon={<DollarSign className="w-4 h-4" />}
              label="الملخص المالي"
            />
            <TabButton
              active={activeTab === 'sales'}
              onClick={() => setActiveTab('sales')}
              icon={<TrendingUp className="w-4 h-4" />}
              label="تقرير المبيعات"
            />
            <TabButton
              active={activeTab === 'purchases'}
              onClick={() => setActiveTab('purchases')}
              icon={<ShoppingCart className="w-4 h-4" />}
              label="تقرير المشتريات"
            />
            <TabButton
              active={activeTab === 'inventory'}
              onClick={() => setActiveTab('inventory')}
              icon={<Package className="w-4 h-4" />}
              label="تقرير المخزون"
            />
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'financial' && <FinancialReport />}
          {activeTab === 'sales' && <SalesReport />}
          {activeTab === 'purchases' && <PurchasesReport />}
          {activeTab === 'inventory' && <InventoryReport />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, subtitle, color }: any) {
  const colors = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {trend !== undefined && (
            <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '+' : ''}{trend}% من الشهر الماضي
            </p>
          )}
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg ${colors[color as keyof typeof colors]} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
        active
          ? 'bg-blue-50 text-blue-600 font-medium'
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function FinancialReport() {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">الملخص المالي</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">إجمالي الإيرادات</p>
          <p className="text-xl font-bold text-slate-900 mt-1">125,000 ج.م</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">إجمالي المصروفات</p>
          <p className="text-xl font-bold text-slate-900 mt-1">85,000 ج.م</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg col-span-2">
          <p className="text-sm text-green-600">صافي الربح</p>
          <p className="text-2xl font-bold text-green-700 mt-1">40,000 ج.م</p>
        </div>
      </div>
    </div>
  );
}

function SalesReport() {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">تقرير المبيعات</h3>
      <p className="text-sm text-slate-500">عرض تفصيلي لحركة المبيعات</p>
      <div className="text-center py-8 text-slate-400">
        <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>سيتم إضافة التفاصيل قريباً</p>
      </div>
    </div>
  );
}

function PurchasesReport() {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">تقرير المشتريات</h3>
      <p className="text-sm text-slate-500">عرض تفصيلي لحركة المشتريات</p>
      <div className="text-center py-8 text-slate-400">
        <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>سيتم إضافة التفاصيل قريباً</p>
      </div>
    </div>
  );
}

function InventoryReport() {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">تقرير المخزون</h3>
      <p className="text-sm text-slate-500">عرض تفصيلي لحالة المخزون</p>
      <div className="text-center py-8 text-slate-400">
        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>سيتم إضافة التفاصيل قريباً</p>
      </div>
    </div>
  );
}
