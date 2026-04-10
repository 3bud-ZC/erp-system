'use client';

import { useEffect, useState } from 'react';
import EnhancedCard from '@/components/EnhancedCard';
import MobileCard from '@/components/MobileCard';
import EnhancedTable from '@/components/EnhancedTable';
import MobileTable from '@/components/MobileTable';
import { DollarSign, ShoppingCart, TrendingUp, Package, ArrowUp, ArrowDown } from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    lowStockProducts: 0,
    recentSalesInvoices: [],
    recentPurchaseInvoices: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/dashboard');
        const dashboardData = await response.json();
        setData(dashboardData);
      } catch (error) {
        console.log('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const salesColumns = [
    { key: 'invoiceNumber', label: 'رقم الفاتورة' },
    { key: 'customer', label: 'العميل' },
    { key: 'total', label: 'الإجمالي' },
    { key: 'date', label: 'التاريخ' },
  ];

  const purchaseColumns = [
    { key: 'invoiceNumber', label: 'رقم الفاتورة' },
    { key: 'supplier', label: 'المورد' },
    { key: 'total', label: 'الإجمالي' },
    { key: 'date', label: 'التاريخ' },
  ];

  const formattedSalesInvoices = data.recentSalesInvoices.map((invoice: any) => ({
    ...invoice,
    customer: typeof invoice.customer?.nameAr === 'string' ? invoice.customer.nameAr : '-',
    date: new Date(invoice.date).toLocaleDateString('ar-EG'),
    total: `${invoice.total.toFixed(2)} EGP`,
  }));

  const formattedPurchaseInvoices = data.recentPurchaseInvoices.map((invoice: any) => ({
    ...invoice,
    supplier: typeof invoice.supplier?.nameAr === 'string' ? invoice.supplier.nameAr : '-',
    date: new Date(invoice.date).toLocaleDateString('ar-EG'),
    total: `${invoice.total.toFixed(2)} EGP`,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl backdrop-blur-xl" />
        <div className="relative">
          <h1 className="text-4xl font-bold gradient-text mb-3">
            لوحة التحكم
          </h1>
          <p className="text-gray-600/80 text-lg">نظرة عامة على نشاط المصنع</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Desktop Cards */}
        <div className="hidden lg:block animate-slideUp">
          <EnhancedCard
            title="إجمالي المبيعات"
            value={`${data.totalSales.toFixed(2)} EGP`}
            icon={<TrendingUp className="w-6 h-6" />}
            color="green"
            trend={{ value: "12.5%", isPositive: true }}
          />
        </div>
        <div className="hidden lg:block animate-slideUp" style={{ animationDelay: '0.1s' }}>
          <EnhancedCard
            title="إجمالي المشتريات"
            value={`${data.totalPurchases.toFixed(2)} EGP`}
            icon={<ShoppingCart className="w-6 h-6" />}
            color="blue"
            trend={{ value: "8.2%", isPositive: true }}
          />
        </div>
        <div className="hidden lg:block animate-slideUp" style={{ animationDelay: '0.2s' }}>
          <EnhancedCard
            title="إجمالي المصروفات"
            value={`${data.totalExpenses.toFixed(2)} EGP`}
            icon={<DollarSign className="w-6 h-6" />}
            color="red"
            trend={{ value: "3.1%", isPositive: false }}
          />
        </div>
        <div className="hidden lg:block animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <EnhancedCard
            title="منتجات منخفضة المخزون"
            value={data.lowStockProducts.toString()}
            icon={<Package className="w-6 h-6" />}
            color="orange"
            trend={{ value: '2.3%', isPositive: false }}
          />
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden">
          <MobileCard
            title="إجمالي المبيعات"
            value={`${data.totalSales.toFixed(2)} EGP`}
            icon={<TrendingUp className="w-5 h-5" />}
            color="green"
            trend={{ value: "12.5%", isPositive: true }}
            compact={true}
          />
        </div>
        <div className="lg:hidden">
          <MobileCard
            title="إجمالي المشتريات"
            value={`${data.totalPurchases.toFixed(2)} EGP`}
            icon={<ShoppingCart className="w-5 h-5" />}
            color="blue"
            trend={{ value: "8.2%", isPositive: true }}
            compact={true}
          />
        </div>
        <div className="lg:hidden">
          <MobileCard
            title="المصروفات"
            value={`${data.totalExpenses.toFixed(2)} EGP`}
            icon={<DollarSign className="w-5 h-5" />}
            color="red"
            trend={{ value: "3.1%", isPositive: false }}
            compact={true}
          />
        </div>
        <div className="lg:hidden">
          <MobileCard
            title="صافي الربح"
            value={`${(data.totalSales - data.totalExpenses).toFixed(2)} EGP`}
            icon={<DollarSign className="w-5 h-5" />}
            color="purple"
            trend={{ value: "15.3%", isPositive: true }}
            compact={true}
          />
        </div>
      </div>

      {/* Tables Section */}
      <div className="space-y-8">
        {/* Sales Invoices */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">أحدث فواتير البيع</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
              <span className="text-sm text-gray-500/80 font-medium">مباشر</span>
            </div>
          </div>
          {/* Desktop Table */}
          <div className="hidden lg:block">
            <EnhancedTable 
              columns={salesColumns} 
              data={formattedSalesInvoices} 
              searchable={true}
              className="shadow-lg"
            />
          </div>
          {/* Mobile Table */}
          <div className="lg:hidden">
            <MobileTable 
              columns={salesColumns} 
              data={formattedSalesInvoices} 
              searchable={true}
              className="shadow-lg"
            />
          </div>
        </div>

        {/* Purchase Invoices */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">أحدث فواتير الشراء</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
              <span className="text-sm text-gray-500/80 font-medium">مباشر</span>
            </div>
          </div>
          {/* Desktop Table */}
          <div className="hidden lg:block">
            <EnhancedTable 
              columns={purchaseColumns} 
              data={formattedPurchaseInvoices} 
              searchable={true}
              className="shadow-lg"
            />
          </div>
          {/* Mobile Table */}
          <div className="lg:hidden">
            <MobileTable 
              columns={purchaseColumns} 
              data={formattedPurchaseInvoices} 
              searchable={true}
              className="shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Alert */}
      {data.lowStockProducts > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200/50 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <Package className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <p className="text-yellow-900 font-bold text-lg">
                warning: {data.lowStockProducts} products below minimum stock
              </p>
              <p className="text-yellow-700 text-sm mt-1">
                please check inventory and restock soon
              </p>
            </div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}
