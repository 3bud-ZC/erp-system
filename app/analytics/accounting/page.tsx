'use client';

import DashboardModule from '@/components/dashboard/DashboardModule';
import ChartWrapper from '@/components/ui/ChartWrapper';
import { Wallet, CreditCard, TrendingUp, BookOpen } from 'lucide-react';

const money = (v: any) => Number(v || 0).toLocaleString('ar-EG', { maximumFractionDigits: 0 });

export default function AccountingAnalytics() {
  return (
    <DashboardModule
      title="تحليلات المحاسبة"
      subtitle="الذمم والإيرادات والمصروفات"
      endpoint="/api/dashboards/accounting"
      kpis={[
        { key: 'accountsReceivable', label: 'الذمم المدينة', format: money, accent: 'blue', icon: <Wallet size={18} /> },
        { key: 'accountsPayable', label: 'الذمم الدائنة', format: money, accent: 'red', icon: <CreditCard size={18} /> },
        { key: 'netIncome', label: 'صافي الدخل', format: money, accent: 'green', icon: <TrendingUp size={18} /> },
        { key: 'journalEntries', label: 'القيود المحاسبية', accent: 'violet', icon: <BookOpen size={18} /> },
      ]}
      renderCharts={(c) => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartWrapper title="الإيرادات حسب الحساب" type="bar" color="#10b981" data={(c.revenueByAccount || []).map((x: any) => ({ label: (x.accountId || '').slice(-4), value: Number(x._sum?.credit || 0) }))} />
          <ChartWrapper title="المصروفات حسب الحساب" type="bar" color="#ef4444" data={(c.expenseByAccount || []).map((x: any) => ({ label: (x.accountId || '').slice(-4), value: Number(x._sum?.debit || 0) }))} />
        </div>
      )}
      renderTrends={(t) => (
        <ChartWrapper title="الإيرادات مقابل المصروفات" type="bar" data={t.revenueVsExpenses || []} />
      )}
    />
  );
}
