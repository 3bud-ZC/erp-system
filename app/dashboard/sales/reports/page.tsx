'use client';

import { useState, useEffect } from 'react';
import EnhancedCard from '@/components/EnhancedCard';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Calendar, Download, Users } from 'lucide-react';
import Link from 'next/link';

export default function SalesReportsPage() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportData, setReportData] = useState({
    totalSales: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    topCustomers: [] as any[],
    monthlyTrends: [] as any[],
    productPerformance: [] as any[],
  });

  useEffect(() => {
    generateReport();
  }, [dateRange]);

  const generateReport = async () => {
    // Mock data for demonstration
    setReportData({
      totalSales: 320000,
      totalRevenue: 45000,
      averageOrderValue: 10666.67,
      topCustomers: [
        { name: 'customer a', total: 180000, orders: 20 },
        { name: 'customer b', total: 90000, orders: 15 },
        { name: 'customer c', total: 50000, orders: 10 },
      ],
      monthlyTrends: [
        { month: 'jan', amount: 55000 },
        { month: 'feb', amount: 62000 },
        { month: 'mar', amount: 58000 },
        { month: 'apr', amount: 71000 },
        { month: 'may', amount: 74000 },
      ],
      productPerformance: [
        { product: 'product a', units: 1200, revenue: 180000 },
        { product: 'product b', units: 800, revenue: 100000 },
        { product: 'product c', units: 600, revenue: 40000 },
      ],
    });
  };

  const exportReport = () => {
    alert('report exported successfully');
  };

  const statsCards = [
    {
      title: 'total sales',
      value: `${reportData.totalSales.toLocaleString()} EGP`,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'green' as const,
      trend: { value: '18.5%', isPositive: true },
    },
    {
      title: 'total orders',
      value: '30',
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'blue' as const,
      trend: { value: '12.0%', isPositive: true },
    },
    {
      title: 'average order value',
      value: `${reportData.averageOrderValue.toFixed(2)} EGP`,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'purple' as const,
      trend: { value: '8.3%', isPositive: true },
    },
    {
      title: 'total customers',
      value: '45',
      icon: <Users className="w-6 h-6" />,
      color: 'orange' as const,
      trend: { value: '15.0%', isPositive: true },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">sales reports</h1>
          <p className="text-gray-600 mt-1">analyze sales data and performance</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/sales/customers"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            customers
          </Link>
          <Link
            href="/sales/invoices"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            invoices
          </Link>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <Download className="w-5 h-5" />
            export
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">date range</h2>
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">start date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">end date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={generateReport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            generate report
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Customers */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">top customers</h2>
          <div className="space-y-4">
            {reportData.topCustomers.map((customer, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-900">{customer.name}</div>
                  <div className="text-sm text-gray-600">{customer.orders} orders</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{customer.total.toLocaleString()} EGP</div>
                  <div className="text-sm text-gray-600">{((customer.total / reportData.totalSales) * 100).toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product Performance */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">product performance</h2>
          <div className="space-y-4">
            {reportData.productPerformance.map((product, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">{product.product}</span>
                  <span className="font-bold text-gray-900">{product.revenue.toLocaleString()} EGP</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${(product.revenue / reportData.totalSales) * 100}%` }}
                  />
                </div>
                <div className="text-sm text-gray-600">{product.units} units sold</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">monthly trends</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {reportData.monthlyTrends.map((trend, index) => (
            <div key={index} className="text-center p-4 bg-gray-50 rounded-xl">
              <div className="font-semibold text-gray-900 capitalize">{trend.month}</div>
              <div className="text-2xl font-bold text-green-600">{trend.amount.toLocaleString()}</div>
              <div className="text-sm text-gray-600">EGP</div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-lg border border-green-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">revenue summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{reportData.totalSales.toLocaleString()}</div>
            <div className="text-sm text-gray-600 mt-1">total sales (EGP)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{reportData.totalRevenue.toLocaleString()}</div>
            <div className="text-sm text-gray-600 mt-1">total revenue (EGP)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{((reportData.totalRevenue / reportData.totalSales) * 100).toFixed(1)}%</div>
            <div className="text-sm text-gray-600 mt-1">profit margin</div>
          </div>
        </div>
      </div>
    </div>
  );
}
