'use client';

import { useState, useMemo } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import { FileText, TrendingUp, TrendingDown, Package, DollarSign, Users, ShoppingCart, AlertCircle } from 'lucide-react';

interface ReportData {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  lowStockCount: number;
  salesGrowth: number;
  purchaseGrowth: number;
  grossProfit: number;
  netProfit: number;
}

export default function ReportsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'financial' | 'sales' | 'purchases' | 'inventory'>('financial');

  const results = useQueries({
    queries: [
      { queryKey: queryKeys.dashboard, queryFn: () => apiGet<any>('/api/dashboard'), staleTime: 30_000 },
      { queryKey: queryKeys.customers, queryFn: () => apiGet<any[]>('/api/customers'), staleTime: 60_000 },
      { queryKey: queryKeys.suppliers, queryFn: () => apiGet<any[]>('/api/suppliers'), staleTime: 60_000 },
    ],
  });
  const [dashQ, custQ, suppQ] = results;

  const loading = results.some(r => r.isLoading);
  const error = dashQ.error ? (dashQ.error as Error).message : null;

  const data: ReportData | null = useMemo(() => {
    const d = dashQ.data;
    if (!d) return null;
    return {
      totalSales: Number(d.totalSales ?? 0),
      totalPurchases: Number(d.totalPurchases ?? 0),
      totalExpenses: Number(d.totalExpenses ?? 0),
      totalProducts: Number(d.totalProducts ?? 0),
      totalCustomers: custQ.data?.length ?? 0,
      totalSuppliers: suppQ.data?.length ?? 0,
      lowStockCount: Number(d.lowStockProducts ?? 0),
      salesGrowth: Number(d.salesTrend ?? 0),
      purchaseGrowth: Number(d.purchasesTrend ?? 0),
      grossProfit: Number(d.grossProfit ?? 0),
      netProfit: Number(d.netProfit ?? 0),
    };
  }, [dashQ.data, custQ.data, suppQ.data]);

  const loadData = () => {
    qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    qc.invalidateQueries({ queryKey: queryKeys.customers });
    qc.invalidateQueries({ queryKey: queryKeys.suppliers });
  };

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

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 gap-3" dir="rtl">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const safeData = data ?? {
    totalSales: 0, totalPurchases: 0, totalExpenses: 0,
    totalProducts: 0, totalCustomers: 0, totalSuppliers: 0,
    lowStockCount: 0, salesGrowth: 0, purchaseGrowth: 0,
    grossProfit: 0, netProfit: 0,
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">التقارير</h1>
          <p className="text-sm text-slate-500 mt-1">ملخص شامل لأداء النظام</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي المبيعات"
          value={`${safeData.totalSales.toLocaleString('ar-EG')} ج.م`}
          icon={<TrendingUp className="w-5 h-5" />}
          trend={safeData.salesGrowth}
          color="green"
        />
        <StatCard
          title="إجمالي المشتريات"
          value={`${safeData.totalPurchases.toLocaleString('ar-EG')} ج.م`}
          icon={<TrendingDown className="w-5 h-5" />}
          trend={safeData.purchaseGrowth}
          color="blue"
        />
        <StatCard
          title="المنتجات"
          value={safeData.totalProducts.toString()}
          icon={<Package className="w-5 h-5" />}
          subtitle={`${safeData.lowStockCount} منتج منخفض المخزون`}
          color="purple"
        />
        <StatCard
          title="العملاء والموردين"
          value={`${safeData.totalCustomers} / ${safeData.totalSuppliers}`}
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
          {activeTab === 'financial' && <FinancialReport data={safeData} />}
          {activeTab === 'sales' && <SalesReport data={safeData} />}
          {activeTab === 'purchases' && <PurchasesReport data={safeData} />}
          {activeTab === 'inventory' && <InventoryReport data={safeData} />}
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
          {trend !== undefined && trend !== 0 && (
            <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% من الشهر الماضي
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

function FinancialReport({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">الملخص المالي</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">إجمالي الإيرادات</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{data.totalSales.toLocaleString('ar-EG')} ج.م</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">إجمالي المصروفات</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{data.totalExpenses.toLocaleString('ar-EG')} ج.م</p>
        </div>
        <div className={`p-4 rounded-lg col-span-2 ${data.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className={`text-sm ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>صافي الربح</p>
          <p className={`text-2xl font-bold mt-1 ${data.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {data.netProfit.toLocaleString('ar-EG')} ج.م
          </p>
        </div>
      </div>
    </div>
  );
}

function SalesReport({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">تقرير المبيعات</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">إجمالي المبيعات</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{data.totalSales.toLocaleString('ar-EG')} ج.م</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">عدد العملاء</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{data.totalCustomers}</p>
        </div>
      </div>
    </div>
  );
}

function PurchasesReport({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">تقرير المشتريات</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">إجمالي المشتريات</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{data.totalPurchases.toLocaleString('ar-EG')} ج.م</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">عدد الموردين</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{data.totalSuppliers}</p>
        </div>
      </div>
    </div>
  );
}

function InventoryReport({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">تقرير المخزون</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">إجمالي المنتجات</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{data.totalProducts}</p>
        </div>
        <div className={`p-4 rounded-lg ${data.lowStockCount > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
          <p className={`text-sm ${data.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-500'}`}>منتجات منخفضة المخزون</p>
          <p className={`text-xl font-bold mt-1 ${data.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {data.lowStockCount}
          </p>
        </div>
      </div>
    </div>
  );
}
