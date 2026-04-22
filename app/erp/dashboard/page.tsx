/**
 * ERP Dashboard
 * Main production dashboard with KPIs, alerts, and activity feed
 */

'use client';

import React, { useEffect, useState } from 'react';
import { KPICard } from '@/components/erp/dashboard/KPICard';
import { AlertCard } from '@/components/erp/dashboard/AlertCard';
import { ActivityFeed } from '@/components/erp/dashboard/ActivityFeed';
import { WorkflowStatusOverview } from '@/components/erp/dashboard/WorkflowStatusOverview';
import { KPI, ERPAlert, ActivityEvent } from '@/lib/erp-frontend-core/types';
import {
  fetchDashboardKPIs,
  fetchDashboardAlerts,
  fetchActivityFeed,
} from '@/lib/erp-frontend-core/engine-integration';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  AlertCircle,
  Clock,
} from 'lucide-react';

// Sample KPIs for initial render
const sampleKPIs: KPI[] = [
  {
    id: '1',
    title: 'Revenue',
    titleAr: 'الإيرادات',
    value: 150000,
    format: 'currency',
    trend: 'up',
    change: 12.5,
    icon: 'TrendingUp',
    color: 'bg-blue-600',
  },
  {
    id: '2',
    title: 'Profit',
    titleAr: 'الأرباح',
    value: 45000,
    format: 'currency',
    trend: 'up',
    change: 8.3,
    icon: 'DollarSign',
    color: 'bg-green-600',
  },
  {
    id: '3',
    title: 'Accounts Receivable',
    titleAr: 'الذمم المدينة',
    value: 85000,
    format: 'currency',
    trend: 'down',
    change: 5.2,
    icon: 'Users',
    color: 'bg-amber-600',
  },
  {
    id: '4',
    title: 'Accounts Payable',
    titleAr: 'الذمم الدائنة',
    value: 42000,
    format: 'currency',
    trend: 'neutral',
    change: 0,
    icon: 'TrendingDown',
    color: 'bg-red-600',
  },
  {
    id: '5',
    title: 'Stock Value',
    titleAr: 'قيمة المخزون',
    value: 125000,
    format: 'currency',
    trend: 'up',
    change: 3.1,
    icon: 'Package',
    color: 'bg-purple-600',
  },
  {
    id: '6',
    title: 'Pending Orders',
    titleAr: 'طلبات معلقة',
    value: 23,
    format: 'number',
    trend: 'up',
    change: 15,
    icon: 'Clock',
    color: 'bg-orange-600',
  },
];

const iconComponents = {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  AlertCircle,
  Clock,
};

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPI[]>(sampleKPIs);
  const [alerts, setAlerts] = useState<ERPAlert[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [kpisData, alertsData, activitiesData] = await Promise.all([
          fetchDashboardKPIs(),
          fetchDashboardAlerts(),
          fetchActivityFeed(10),
        ]);

        if (kpisData.length > 0) setKpis(kpisData);
        setAlerts(alertsData);
        setActivities(activitiesData);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة المعلومات</h1>
          <p className="text-gray-500 mt-1">نظرة عامة على أداء الشركة</p>
        </div>
        <div className="text-sm text-gray-500">
          آخر تحديث: {new Date().toLocaleDateString('ar-SA')}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => {
          const IconComponent = iconComponents[kpi.icon as keyof typeof iconComponents] || TrendingUp;
          return (
            <KPICard
              key={kpi.id}
              title={kpi.title}
              titleAr={kpi.titleAr}
              value={kpi.value}
              format={kpi.format}
              trend={kpi.trend}
              change={kpi.change}
              icon={IconComponent}
              color={kpi.color}
              loading={loading}
            />
          );
        })}
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts */}
        <div className="lg:col-span-1">
          <AlertCard alerts={alerts} loading={loading} />
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-1">
          <ActivityFeed activities={activities} loading={loading} />
        </div>

        {/* Workflow Status */}
        <div className="lg:col-span-1">
          <WorkflowStatusOverview loading={loading} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">إجراءات سريعة</h3>
        <div className="flex flex-wrap gap-3">
          <QuickActionButton href="/erp/sales/invoices/create" color="blue">
            إنشاء فاتورة بيع
          </QuickActionButton>
          <QuickActionButton href="/erp/purchases/orders/create" color="green">
            إنشاء أمر شراء
          </QuickActionButton>
          <QuickActionButton href="/erp/inventory/products/create" color="purple">
            إضافة منتج
          </QuickActionButton>
          <QuickActionButton href="/erp/accounting/journal/create" color="amber">
            قيد يدوي
          </QuickActionButton>
          <QuickActionButton href="/erp/production/orders/create" color="indigo">
            أمر إنتاج
          </QuickActionButton>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({
  href,
  children,
  color,
}: {
  href: string;
  children: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
    indigo: 'bg-indigo-600 hover:bg-indigo-700',
  };

  return (
    <a
      href={href}
      className={`inline-flex items-center px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
        colorClasses[color] || colorClasses.blue
      }`}
    >
      {children}
    </a>
  );
}
