'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader } from 'lucide-react';

interface ProfitAndLoss {
  period: { from: string; to: string };
  revenue: { salesRevenue: number };
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: {
    salaries: number;
    rent: number;
    utilities: number;
    marketing: number;
    miscellaneous: number;
    total: number;
  };
  operatingIncome: number;
  netIncome: number;
}

export default function ProfitLossPage() {
  const [data, setData] = useState<ProfitAndLoss | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadReport();
  }, [dateRange]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: 'profit-loss',
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
      });
      const response = await fetch(`/api/reports?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result.profitAndLoss);
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-center">فشل تحميل التقرير</div>;
  }

  const profitMargin = data.revenue.salesRevenue > 0 ? (data.netIncome / data.revenue.salesRevenue) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">قائمة الدخل</h1>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">من التاريخ</label>
          <input
            type="date"
            value={dateRange.fromDate}
            onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">إلى التاريخ</label>
          <input
            type="date"
            value={dateRange.toDate}
            onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
            className="border rounded-lg px-3 py-2"
          />
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow p-6">
          <p className="text-sm opacity-90">إجمالي الإيرادات</p>
          <p className="text-2xl font-bold mt-2">{data.revenue.salesRevenue.toFixed(2)} ريال</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg shadow p-6">
          <p className="text-sm opacity-90">تكلفة البضاعة</p>
          <p className="text-2xl font-bold mt-2">{data.costOfGoodsSold.toFixed(2)} ريال</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg shadow p-6">
          <p className="text-sm opacity-90">المصروفات العملياتية</p>
          <p className="text-2xl font-bold mt-2">{data.operatingExpenses.total.toFixed(2)} ريال</p>
        </div>

        <div className={`bg-gradient-to-br ${data.netIncome >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} text-white rounded-lg shadow p-6`}>
          <p className="text-sm opacity-90">صافي الدخل</p>
          <p className="text-2xl font-bold mt-2">{data.netIncome.toFixed(2)} ريال</p>
        </div>
      </div>

      {/* Detailed Statement */}
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold mb-2">قائمة الدخل الشاملة</h2>
        <p className="text-sm text-gray-600 mb-6">
          للفترة من {new Date(dateRange.fromDate).toLocaleDateString('ar-SA')} إلى {new Date(dateRange.toDate).toLocaleDateString('ar-SA')}
        </p>

        <div className="space-y-0 border-t pt-4">
          {/* Revenue Section */}
          <div className="flex justify-between items-center py-3 border-b">
            <span className="font-bold text-lg">الإيرادات:</span>
            <span></span>
          </div>
          <div className="flex justify-between items-center py-2 pl-8">
            <span>مبيعات</span>
            <span>{data.revenue.salesRevenue.toFixed(2)} ريال</span>
          </div>
          <div className="flex justify-between items-center py-3 bg-gray-50 px-4 rounded font-bold text-lg mt-2 mb-4">
            <span>إجمالي الإيرادات</span>
            <span>{data.revenue.salesRevenue.toFixed(2)} ريال</span>
          </div>

          {/* COGS Section */}
          <div className="flex justify-between items-center py-3 border-b">
            <span className="font-bold text-lg">ناقص: تكلفة البضاعة المباعة</span>
            <span className="font-bold text-lg text-red-600">{data.costOfGoodsSold.toFixed(2)} ريال</span>
          </div>
          <div className="flex justify-between items-center py-3 bg-blue-50 px-4 rounded font-bold text-lg mt-2 mb-4">
            <span>الربح الإجمالي</span>
            <span>{data.grossProfit.toFixed(2)} ريال</span>
          </div>

          {/* Operating Expenses Section */}
          <div className="flex justify-between items-center py-3 border-b">
            <span className="font-bold text-lg">المصروفات العملياتية:</span>
            <span></span>
          </div>
          <div className="space-y-2 pl-8 py-2">
            <div className="flex justify-between items-center text-sm">
              <span>الرواتب والأجور</span>
              <span>{data.operatingExpenses.salaries.toFixed(2)} ريال</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>الإيجار</span>
              <span>{data.operatingExpenses.rent.toFixed(2)} ريال</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>المياه والكهرباء</span>
              <span>{data.operatingExpenses.utilities.toFixed(2)} ريال</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>التسويق والإعلان</span>
              <span>{data.operatingExpenses.marketing.toFixed(2)} ريال</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span>مصروفات أخرى</span>
              <span>{data.operatingExpenses.miscellaneous.toFixed(2)} ريال</span>
            </div>
          </div>
          <div className="flex justify-between items-center py-2 pl-8 border-b">
            <span className="font-bold">إجمالي المصروفات العملياتية</span>
            <span className="font-bold text-red-600">{data.operatingExpenses.total.toFixed(2)} ريال</span>
          </div>

          {/* Operating Income */}
          <div className="flex justify-between items-center py-3 bg-green-50 px-4 rounded font-bold text-lg mt-2 mb-4">
            <span>الدخل التشغيلي</span>
            <span>{data.operatingIncome.toFixed(2)} ريال</span>
          </div>

          {/* Net Income */}
          <div className={`flex justify-between items-center py-4 px-4 rounded font-bold text-lg ${data.netIncome >= 0 ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}>
            <span className="flex items-center gap-2">
              {data.netIncome >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
              صافي الدخل
            </span>
            <span>{data.netIncome.toFixed(2)} ريال</span>
          </div>

          {/* Profit Margin */}
          <div className="flex justify-between items-center py-3 mt-4 border-t">
            <span className="text-gray-700">هامش الربح</span>
            <span className={`font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profitMargin.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
