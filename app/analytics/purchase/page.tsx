'use client';

import DashboardModule from '@/components/dashboard/DashboardModule';
import ChartWrapper from '@/components/ui/ChartWrapper';
import { ShoppingCart, FileText, Package, ClipboardList } from 'lucide-react';

const money = (v: any) => Number(v || 0).toLocaleString('ar-EG', { maximumFractionDigits: 0 });

export default function PurchaseAnalytics() {
  return (
    <DashboardModule
      title="تحليلات المشتريات"
      subtitle="أداء المشتريات والموردين"
      endpoint="/api/dashboards/purchase"
      kpis={[
        { key: 'totalPurchases', label: 'إجمالي المشتريات', format: money, accent: 'blue', icon: <ShoppingCart size={18} /> },
        { key: 'openPurchaseOrders', label: 'أوامر شراء مفتوحة', accent: 'amber', icon: <ClipboardList size={18} /> },
        { key: 'pendingGoodsReceipts', label: 'استلامات معلقة', accent: 'red', icon: <Package size={18} /> },
        { key: 'invoicesCount', label: 'عدد الفواتير', accent: 'violet', icon: <FileText size={18} /> },
      ]}
      renderCharts={(c) => (
        <ChartWrapper title="أفضل الموردين" type="bar" data={(c.topSuppliers || []).slice(0, 8).map((x: any) => ({ label: (x.supplierId || '').slice(-4), value: Number(x._sum?.total || 0) }))} />
      )}
    />
  );
}
