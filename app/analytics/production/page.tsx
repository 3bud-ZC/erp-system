'use client';

import DashboardModule from '@/components/dashboard/DashboardModule';
import ChartWrapper from '@/components/ui/ChartWrapper';
import { Gauge, Loader, CheckCircle2, Trash2 } from 'lucide-react';

export default function ProductionAnalytics() {
  return (
    <DashboardModule
      title="تحليلات الإنتاج"
      subtitle="كفاءة وحجم الإنتاج"
      endpoint="/api/dashboards/production"
      kpis={[
        { key: 'efficiency', label: 'الكفاءة', format: (v) => `${Number(v).toFixed(1)}%`, accent: 'green', icon: <Gauge size={18} /> },
        { key: 'inProgress', label: 'قيد التنفيذ', accent: 'amber', icon: <Loader size={18} /> },
        { key: 'completed', label: 'مكتمل', accent: 'blue', icon: <CheckCircle2 size={18} /> },
        { key: 'totalWaste', label: 'إجمالي الهدر', accent: 'red', icon: <Trash2 size={18} /> },
      ]}
      renderCharts={(c) => (
        <ChartWrapper title="الإنتاج حسب الخط" type="bar" color="#8b5cf6" data={(c.productionByLine || []).map((x: any) => ({ label: (x.productionLineId || '').slice(-4), value: Number(x._sum?.quantity || 0) }))} />
      )}
    />
  );
}
