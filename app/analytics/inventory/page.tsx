'use client';

import DashboardModule from '@/components/dashboard/DashboardModule';
import ChartWrapper from '@/components/ui/ChartWrapper';
import Table from '@/components/ui/Table';
import Card from '@/components/ui/card';
import { Boxes, Package, AlertTriangle, ArrowDownToLine } from 'lucide-react';

const money = (v: any) => Number(v || 0).toLocaleString('ar-EG', { maximumFractionDigits: 0 });

export default function InventoryAnalytics() {
  return (
    <DashboardModule
      title="تحليلات المخزون"
      subtitle="حركة وقيمة المخزون"
      endpoint="/api/dashboards/inventory"
      kpis={[
        { key: 'totalInventoryValue', label: 'قيمة المخزون', format: money, accent: 'green', icon: <Boxes size={18} /> },
        { key: 'totalProducts', label: 'عدد المنتجات', accent: 'blue', icon: <Package size={18} /> },
        { key: 'lowStockCount', label: 'مخزون منخفض', accent: 'red', icon: <AlertTriangle size={18} /> },
        { key: 'inbound', label: 'الوارد', accent: 'violet', icon: <ArrowDownToLine size={18} /> },
      ]}
      renderCharts={(c) => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartWrapper title="القيمة حسب المستودع" type="bar" data={(c.valueByWarehouse || []).map((x: any) => ({ label: (x.warehouseId || '').slice(-4), value: Number(x._sum?.totalValue || 0) }))} />
          <Card title="منتجات بمخزون منخفض" padding={false}>
            <Table
              columns={[
                { key: 'code', header: 'الكود' },
                { key: 'nameAr', header: 'الاسم' },
                { key: 'stock', header: 'المخزون', align: 'center' },
              ]}
              rows={c.lowStockItems || []}
              keyField="id"
              emptyLabel="لا توجد عناصر منخفضة"
            />
          </Card>
        </div>
      )}
      renderTrends={(t) => (
        <ChartWrapper title="حركة المخزون" type="bar" color="#10b981" data={t.movement || []} />
      )}
    />
  );
}
