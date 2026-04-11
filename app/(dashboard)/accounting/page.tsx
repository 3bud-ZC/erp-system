'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, PieChart } from 'lucide-react';

interface FinancialSummary {
  profitAndLoss: any;
  balanceSheet: any;
  inventory: any;
}

export default function AccountingPage() {
  const [data, setData] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await fetch('/api/reports?type=summary');
      if (response.ok) {
        setData(await response.json());
      }
    } catch (error) {
      console.error('Error loading accounting data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">جاري التحميل...</div>;
  }

  if (!data) {
    return <div className="p-6 text-center">فشل تحميل البيانات</div>;
  }

  const { profitAndLoss, balanceSheet } = data;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">الملخص المالي</h1>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold mt-2">{profitAndLoss?.revenue?.salesRevenue?.toFixed(2) || 0} ريال</p>
            </div>
            <DollarSign className="w-10 h-10 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">تكلفة البضاعة المباعة</p>
              <p className="text-2xl font-bold mt-2">{profitAndLoss?.costOfGoodsSold?.toFixed(2) || 0} ريال</p>
            </div>
            <TrendingUp className="w-10 h-10 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">صافي الدخل</p>
              <p className="text-2xl font-bold mt-2">{profitAndLoss?.netIncome?.toFixed(2) || 0} ريال</p>
            </div>
            <BarChart3 className="w-10 h-10 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">إجمالي الأصول</p>
              <p className="text-2xl font-bold mt-2">{balanceSheet?.assets?.total?.toFixed(2) || 0} ريال</p>
            </div>
            <PieChart className="w-10 h-10 opacity-50" />
          </div>
        </div>
      </div>

      {/* Statement of Income */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">قائمة الدخل</h2>
        <div className="space-y-3 border-t pt-4">
          <div className="flex justify-between items-center">
            <span>الإيرادات من المبيعات</span>
            <span className="font-bold">{profitAndLoss?.revenue?.salesRevenue?.toFixed(2) || 0} ريال</span>
          </div>
          <div className="flex justify-between items-center border-b pb-3">
            <span className="text-red-600">ناقص: تكلفة البضاعة المباعة</span>
            <span className="font-bold text-red-600">({profitAndLoss?.costOfGoodsSold?.toFixed(2) || 0}) ريال</span>
          </div>
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded">
            <span className="font-bold">الربح الإجمالي</span>
            <span className="font-bold">{profitAndLoss?.grossProfit?.toFixed(2) || 0} ريال</span>
          </div>
          <div className="flex justify-between items-center mt-3 border-b pb-3">
            <span className="text-red-600">ناقص: المصروفات العملياتية</span>
            <span className="font-bold text-red-600">({profitAndLoss?.operatingExpenses?.total?.toFixed(2) || 0}) ريال</span>
          </div>
          <div className="flex justify-between items-center bg-green-50 p-3 rounded text-lg font-bold">
            <span>صافي الدخل</span>
            <span>{profitAndLoss?.netIncome?.toFixed(2) || 0} ريال</span>
          </div>
        </div>
      </div>

      {/* Balance Sheet Summary */}
      <div className="grid grid-cols-3 gap-4">
        {/* Assets */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-4">الأصول</h3>
          <div className="space-y-2 border-b pb-3">
            {Object.entries(balanceSheet?.assets?.items || {}).map(([code, asset]: any) => (
              <div key={code} className="flex justify-between text-sm">
                <span>{asset.name}</span>
                <span>{asset.balance?.toFixed(2)} ريال</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold mt-3 pt-3 border-t">
            <span>إجمالي الأصول</span>
            <span>{balanceSheet?.assets?.total?.toFixed(2) || 0} ريال</span>
          </div>
        </div>

        {/* Liabilities */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-4">الالتزامات</h3>
          <div className="space-y-2 border-b pb-3">
            {Object.entries(balanceSheet?.liabilities?.items || {}).map(([code, liability]: any) => (
              <div key={code} className="flex justify-between text-sm">
                <span>{liability.name}</span>
                <span>{liability.balance?.toFixed(2)} ريال</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold mt-3 pt-3 border-t">
            <span>إجمالي الالتزامات</span>
            <span>{balanceSheet?.liabilities?.total?.toFixed(2) || 0} ريال</span>
          </div>
        </div>

        {/* Equity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold mb-4">حقوق الملكية</h3>
          <div className="space-y-2 border-b pb-3">
            {Object.entries(balanceSheet?.equity?.items || {}).map(([code, equity]: any) => (
              <div key={code} className="flex justify-between text-sm">
                <span>{equity.name}</span>
                <span>{equity.balance?.toFixed(2)} ريال</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold mt-3 pt-3 border-t">
            <span>إجمالي حقوق الملكية</span>
            <span>{balanceSheet?.equity?.total?.toFixed(2) || 0} ريال</span>
          </div>
        </div>
      </div>

      {/* Balance Check */}
      <div className={`rounded-lg p-4 text-center font-bold ${balanceSheet?.summary?.isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        {balanceSheet?.summary?.isBalanced ? '✓ الميزانية متوازنة' : '✗ الميزانية غير متوازنة'}
      </div>
    </div>
  );
}
