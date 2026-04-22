'use client';

import { useEffect, useState } from 'react';
import { accountingApi } from '@/lib/api/accounting';
import { inventoryApi } from '@/lib/api/inventory';
import { salesApi } from '@/lib/api/sales';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, Package, DollarSign, Users, FileText } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'up' | 'down';
  icon: React.ReactNode;
}

function KPICard({ title, value, change, changeType, icon }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
          {change && (
            <p className={`text-sm mt-2 flex items-center gap-1 ${
              changeType === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {changeType === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {change}
            </p>
          )}
        </div>
        <div className="p-3 bg-blue-100 rounded-lg">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKPIs] = useState({
    revenue: 0,
    profit: 0,
    stockValue: 0,
    cash: 0,
    customers: 0,
    invoices: 0,
  });

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Load KPIs from backend
        const [pAndL, stockValuation] = await Promise.all([
          accountingApi.getProfitAndLoss(),
          inventoryApi.getStockValuation(),
        ]);

        setKPIs({
          revenue: pAndL.revenue,
          profit: pAndL.netProfit,
          stockValue: stockValuation.totalValue,
          cash: 0, // Would come from cash flow report
          customers: 0, // Would come from customers API
          invoices: 0, // Would come from invoices API
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(kpis.revenue)}
          change="+12.5%"
          changeType="up"
          icon={<DollarSign className="w-6 h-6 text-blue-600" />}
        />
        <KPICard
          title="Net Profit"
          value={formatCurrency(kpis.profit)}
          change="+8.2%"
          changeType="up"
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
        />
        <KPICard
          title="Stock Value"
          value={formatCurrency(kpis.stockValue)}
          change="+5.1%"
          changeType="up"
          icon={<Package className="w-6 h-6 text-purple-600" />}
        />
        <KPICard
          title="Cash on Hand"
          value={formatCurrency(kpis.cash)}
          change="-2.3%"
          changeType="down"
          icon={<DollarSign className="w-6 h-6 text-orange-600" />}
        />
        <KPICard
          title="Total Customers"
          value={kpis.customers.toString()}
          change="+15.0%"
          changeType="up"
          icon={<Users className="w-6 h-6 text-indigo-600" />}
        />
        <KPICard
          title="Pending Invoices"
          value={kpis.invoices.toString()}
          change="+3.2%"
          changeType="up"
          icon={<FileText className="w-6 h-6 text-pink-600" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue Trend</h2>
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded">
            <p className="text-slate-500">Revenue chart placeholder</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Stock Movement</h2>
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded">
            <p className="text-slate-500">Stock chart placeholder</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">Invoice #INV-001 created</p>
              <p className="text-xs text-slate-500">2 hours ago</p>
            </div>
            <span className="text-sm text-slate-600">$5,000.00</span>
          </div>
          <div className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">Stock adjustment completed</p>
              <p className="text-xs text-slate-500">4 hours ago</p>
            </div>
            <span className="text-sm text-slate-600">+50 units</span>
          </div>
          <div className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">Payment received</p>
              <p className="text-xs text-slate-500">6 hours ago</p>
            </div>
            <span className="text-sm text-slate-600">$2,500.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
