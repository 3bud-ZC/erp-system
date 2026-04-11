'use client';

import { useState, useEffect } from 'react';
import EnhancedCard from '@/components/EnhancedCard';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Calendar, Download } from 'lucide-react';
import Link from 'next/link';

export default function PurchaseReportsPage() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportData, setReportData] = useState({
    totalPurchases: 0,
    totalExpenses: 0,
    averageOrderValue: 0,
    topSuppliers: [] as any[],
    monthlyTrends: [] as any[],
    categoryBreakdown: [] as any[],
  });

  useEffect(() => {
    generateReport();
  }, [dateRange]);

  const generateReport = async () => {
    // Mock data for demonstration
    setReportData({
      totalPurchases: 245000,
      totalExpenses: 18000,
      averageOrderValue: 8166.67,
      topSuppliers: [
        { name: 'company a', total: 125000, orders: 15 },
        { name: 'company b', total: 80000, orders: 12 },
        { name: 'company c', total: 40000, orders: 8 },
      ],
      monthlyTrends: [
        { month: 'jan', amount: 45000 },
        { month: 'feb', amount: 52000 },
        { month: 'mar', amount: 48000 },
        { month: 'apr', amount: 61000 },
        { month: 'may', amount: 39000 },
      ],
      categoryBreakdown: [
        { category: 'raw materials', amount: 180000, percentage: 73.5 },
        { category: 'packaging', amount: 45000, percentage: 18.4 },
        { category: 'equipment', amount: 20000, percentage: 8.1 },
      ],
    });
  };

  const exportReport = () => {
    alert('report exported successfully');
  };

  const statsCards = [
    {
      title: 'total purchases',
      value: `${reportData.totalPurchases.toLocaleString()} EGP`,
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'blue' as const,
      trend: { value: '12.5%', isPositive: true },
    },
    {
      title: 'total expenses',
      value: `${reportData.totalExpenses.toLocaleString()} EGP`,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'red' as const,
      trend: { value: '8.2%', isPositive: false },
    },
    {
      title: 'average order value',
      value: `${reportData.averageOrderValue.toFixed(2)} EGP`,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'green' as const,
      trend: { value: '5.3%', isPositive: true },
    },
    {
      title: 'total orders',
      value: '30',
      icon: <Calendar className="w-6 h-6" />,
      color: 'purple' as const,
      trend: { value: '15.0%', isPositive: true },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">purchase reports</h1>
          <p className="text-gray-600 mt-1">analyze purchase data and trends</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/purchases/suppliers"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            suppliers
          </Link>
          <Link
            href="/purchases/invoices"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            invoices
          </Link>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">end date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={generateReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
        {/* Top Suppliers */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">top suppliers</h2>
          <div className="space-y-4">
            {reportData.topSuppliers.map((supplier, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-semibold text-gray-900">{supplier.name}</div>
                  <div className="text-sm text-gray-600">{supplier.orders} orders</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{supplier.total.toLocaleString()} EGP</div>
                  <div className="text-sm text-gray-600">{((supplier.total / reportData.totalPurchases) * 100).toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">category breakdown</h2>
          <div className="space-y-4">
            {reportData.categoryBreakdown.map((category, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">{category.category}</span>
                  <span className="font-bold text-gray-900">{category.amount.toLocaleString()} EGP</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${category.percentage}%` }}
                  />
                </div>
                <div className="text-sm text-gray-600">{category.percentage}% of total</div>
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
              <div className="text-2xl font-bold text-blue-600">{trend.amount.toLocaleString()}</div>
              <div className="text-sm text-gray-600">EGP</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
