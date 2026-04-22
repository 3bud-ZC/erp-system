'use client';

import DashboardModule from '@/components/dashboard/DashboardModule';
import ChartWrapper from '@/components/ui/ChartWrapper';
import { DollarSign, ShoppingCart, TrendingUp, Percent, Wallet, CreditCard, Package, Factory } from 'lucide-react';

const money = (v: any) => Number(v || 0).toLocaleString('ar-EG', { maximumFractionDigits: 0 });

export default function FinancialOverview() {
  return (
    <DashboardModule
      title="النظرة المالية العامة"
      subtitle="مؤشرات الأداء الرئيسية عبر جميع الوحدات"
      endpoint="/api/dashboards/financial"
      kpis={[
        { key: 'totalRevenue', label: 'الإيرادات', format: money, accent: 'green', icon: <DollarSign size={18} /> },
        { key: 'totalPurchases', label: 'المشتريات', format: money, accent: 'blue', icon: <ShoppingCart size={18} /> },
        { key: 'grossProfit', label: 'إجمالي الربح', format: money, accent: 'violet', icon: <TrendingUp size={18} /> },
        { key: 'profitMargin', label: 'هامش الربح', format: (v) => `${v}%`, accent: 'amber', icon: <Percent size={18} /> },
        { key: 'accountsReceivable', label: 'الذمم المدينة', format: money, accent: 'blue', icon: <Wallet size={18} /> },
        { key: 'accountsPayable', label: 'الذمم الدائنة', format: money, accent: 'red', icon: <CreditCard size={18} /> },
        { key: 'inventoryValue', label: 'قيمة المخزون', format: money, accent: 'amber', icon: <Package size={18} /> },
        { key: 'productionEfficiency', label: 'كفاءة الإنتاج', format: (v) => `${Number(v).toFixed(1)}%`, accent: 'violet', icon: <Factory size={18} /> },
      ]}
      renderTrends={(t) => (
        <ChartWrapper title="الإيرادات الشهرية" subtitle="أداء السنة الحالية" type="area" color="#2563eb" data={(t.monthlyRevenue || []).map((m: any) => ({ label: `${m.month + 1}`, value: m.total }))} />
      )}
    />
  );
}
