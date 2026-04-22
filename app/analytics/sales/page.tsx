'use client';

import DashboardModule from '@/components/dashboard/DashboardModule';
import ChartWrapper from '@/components/ui/ChartWrapper';
import { DollarSign, FileText, Clock, ShoppingBag } from 'lucide-react';

const money = (v: any) => Number(v || 0).toLocaleString('ar-EG', { maximumFractionDigits: 0 });

export default function SalesAnalytics() {
  return (
    <DashboardModule
      title="تحليلات المبيعات"
      subtitle="أداء المبيعات والعملاء"
      endpoint="/api/dashboards/sales"
      kpis={[
        { key: 'totalRevenue', label: 'إجمالي الإيرادات', format: money, accent: 'green', icon: <DollarSign size={18} /> },
        { key: 'invoicesCount', label: 'عدد الفواتير', accent: 'blue', icon: <FileText size={18} /> },
        { key: 'pendingCount', label: 'فواتير معلقة', accent: 'amber', icon: <Clock size={18} /> },
        { key: 'avgOrderValue', label: 'متوسط الفاتورة', format: money, accent: 'violet', icon: <ShoppingBag size={18} /> },
      ]}
      renderCharts={(c) => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartWrapper title="أفضل العملاء" type="bar" data={(c.topCustomers || []).slice(0, 8).map((x: any) => ({ label: (x.customerId || '').slice(-4), value: Number(x._sum?.total || 0) }))} />
          <ChartWrapper title="أفضل المنتجات" type="bar" color="#8b5cf6" data={(c.topProducts || []).slice(0, 8).map((x: any) => ({ label: (x.productId || '').slice(-4), value: Number(x._sum?.total || 0) }))} />
        </div>
      )}
      renderTrends={(t) => (
        <ChartWrapper title="الإيرادات الشهرية" subtitle="اتجاه الإيرادات خلال السنة" type="area" color="#10b981" data={(t.monthlyRevenue || []).map((m: any) => ({ label: `${m.month + 1}`, value: m.total }))} />
      )}
    />
  );
}
