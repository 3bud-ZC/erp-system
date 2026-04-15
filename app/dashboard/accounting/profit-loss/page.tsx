'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  Calendar,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  HelpCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';

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

// Stats Card
function StatCard({ title, value, subtitle, icon: Icon, color, trend }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-gray-400 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function ProfitLossPage() {
  const [data, setData] = useState<ProfitAndLoss | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    fromDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
  });

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const params = new URLSearchParams({
        type: 'profit-loss',
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
      });
      const response = await fetch(`/api/reports?${params}`, { 
        headers,
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      if (response.ok) {
        const result = await response.json();
        setData(result.data?.profitAndLoss || result.profitAndLoss || null);
      } else {
        throw new Error('فشل في تحميل التقرير');
      }
    } catch (error: any) {
      console.error('Error loading report:', error);
      if (error.name === 'AbortError') {
        setError('استغرق تحميل البيانات وقتاً طويلاً. يرجى المحاولة مرة أخرى.');
      } else {
        setError(error instanceof Error ? error.message : 'فشل في تحميل التقرير');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 mx-auto animate-spin mb-4" />
          <p className="text-gray-600">جاري تحميل قائمة الدخل...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center bg-red-50 border border-red-200 rounded-xl p-8 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 font-medium mb-2">حدث خطأ</p>
          <p className="text-red-600 text-sm mb-4">{error || 'فشل تحميل التقرير'}</p>
          <button
            onClick={loadReport}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const profitMargin = data.revenue.salesRevenue > 0 ? (data.netIncome / data.revenue.salesRevenue) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">قائمة الدخل</h1>
          <p className="text-gray-500 text-sm mt-1">الأرباح والخسائر للفترة المحددة</p>
        </div>
        <button
          onClick={loadReport}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </button>
      </div>

      {/* Explanation Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-indigo-900 mb-2">ما هي قائمة الدخل؟</h3>
            <p className="text-sm text-indigo-800 leading-relaxed mb-2">
              قائمة الدخل (Income Statement) هي تقرير مالي يوضح أداء الشركة المالي خلال فترة زمنية محددة. تُظهر:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-indigo-700 mt-2">
              <div>• <strong>الإيرادات:</strong> إجمالي دخل الشركة من المبيعات</div>
              <div>• <strong>تكلفة البضاعة المباعة (COGS):</strong> تكلفة إنتاج/شراء المنتجات المباعة</div>
              <div>• <strong>الربح الإجمالي:</strong> الإيرادات - تكلفة البضاعة</div>
              <div>• <strong>المصروفات التشغيلية:</strong> مصاريف إدارة الشركة (رواتب، إيجار، إلخ)</div>
              <div>• <strong>الدخل التشغيلي:</strong> الربح الإجمالي - المصروفات التشغيلية</div>
              <div>• <strong>صافي الدخل:</strong> النتيجة النهائية (ربح أو خسارة)</div>
            </div>
            <p className="text-xs text-indigo-600 mt-3 font-medium">
              💡 المعادلة: صافي الدخل = الإيرادات - (تكلفة البضاعة + المصروفات التشغيلية)
            </p>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">من التاريخ</label>
            <input
              type="date"
              value={dateRange.fromDate}
              onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">إلى التاريخ</label>
            <input
              type="date"
              value={dateRange.toDate}
              onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            />
          </div>
          <div className="flex items-end">
            <div className="bg-gray-50 px-4 py-2 rounded-lg text-sm text-gray-600">
              <Calendar className="w-4 h-4 inline ml-1" />
              الفترة: {new Date(dateRange.fromDate).toLocaleDateString('ar-EG')} -{' '}
              {new Date(dateRange.toDate).toLocaleDateString('ar-EG')}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي الإيرادات"
          value={formatCurrency(data.revenue.salesRevenue)}
          subtitle="مبيعات الفترة"
          icon={DollarSign}
          color="bg-blue-500"
        />
        <StatCard
          title="تكلفة البضاعة"
          value={formatCurrency(data.costOfGoodsSold)}
          subtitle="COGS"
          icon={ArrowDownRight}
          color="bg-red-500"
        />
        <StatCard
          title="المصروفات التشغيلية"
          value={formatCurrency(data.operatingExpenses.total)}
          subtitle="OPEX"
          icon={Minus}
          color="bg-orange-500"
        />
        <StatCard
          title="صافي الدخل"
          value={formatCurrency(data.netIncome)}
          subtitle={`هامش الربح: ${profitMargin.toFixed(1)}%`}
          icon={data.netIncome >= 0 ? TrendingUp : TrendingDown}
          color={data.netIncome >= 0 ? 'bg-green-500' : 'bg-red-500'}
        />
      </div>

      {/* Detailed Statement */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">قائمة الدخل التفصيلية</h2>
          <p className="text-gray-500 text-sm mt-1">
            للفترة من {new Date(dateRange.fromDate).toLocaleDateString('ar-EG')} إلى{' '}
            {new Date(dateRange.toDate).toLocaleDateString('ar-EG')}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Revenue Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="font-bold text-gray-900">الإيرادات</span>
              <span></span>
            </div>
            <div className="flex justify-between items-center py-2 pr-4">
              <span className="text-gray-600">مبيعات</span>
              <span className="font-medium">{formatCurrency(data.revenue.salesRevenue)}</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-blue-50 px-4 rounded-lg font-bold text-lg">
              <span>إجمالي الإيرادات</span>
              <span>{formatCurrency(data.revenue.salesRevenue)}</span>
            </div>
          </div>

          {/* COGS Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="font-bold text-gray-900">ناقص: تكلفة البضاعة المباعة</span>
              <span className="font-bold text-red-600">{formatCurrency(data.costOfGoodsSold)}</span>
            </div>
            <div className="flex justify-between items-center py-3 bg-green-50 px-4 rounded-lg font-bold text-lg">
              <span>الربح الإجمالي (Gross Profit)</span>
              <span className={data.grossProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                {formatCurrency(data.grossProfit)}
              </span>
            </div>
          </div>

          {/* Operating Expenses Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="font-bold text-gray-900">المصروفات التشغيلية</span>
              <span></span>
            </div>            <div className="space-y-1 pr-4">
              <div className="flex justify-between items-center py-1 text-sm">
                <span className="text-gray-600">الرواتب والأجور</span>
                <span>{formatCurrency(data.operatingExpenses.salaries)}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-sm">
                <span className="text-gray-600">الإيجار</span>
                <span>{formatCurrency(data.operatingExpenses.rent)}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-sm">
                <span className="text-gray-600">المياه والكهرباء والخدمات</span>
                <span>{formatCurrency(data.operatingExpenses.utilities)}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-sm">
                <span className="text-gray-600">التسويق والإعلان</span>
                <span>{formatCurrency(data.operatingExpenses.marketing)}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-sm">
                <span className="text-gray-600">مصروفات أخرى</span>
                <span>{formatCurrency(data.operatingExpenses.miscellaneous)}</span>
              </div>
            </div>            <div className="flex justify-between items-center py-2 border-t border-gray-200">
              <span className="font-bold">إجمالي المصروفات التشغيلية</span>
              <span className="font-bold text-red-600">{formatCurrency(data.operatingExpenses.total)}</span>
            </div>
          </div>

          {/* Operating Income */}
          <div className="flex justify-between items-center py-3 bg-indigo-50 px-4 rounded-lg font-bold text-lg">
            <span>الدخل التشغيلي (Operating Income)</span>
            <span className={data.operatingIncome >= 0 ? 'text-indigo-700' : 'text-red-700'}>
              {formatCurrency(data.operatingIncome)}
            </span>
          </div>

          {/* Net Income - Final Result */}
          <div
            className={`flex justify-between items-center py-4 px-4 rounded-lg font-bold text-xl ${
              data.netIncome >= 0
                ? 'bg-green-100 border-2 border-green-500'
                : 'bg-red-100 border-2 border-red-500'
            }`}
          >
            <span className="flex items-center gap-2">
              {data.netIncome >= 0 ? (
                <TrendingUp className="w-6 h-6" />
              ) : (
                <TrendingDown className="w-6 h-6" />
              )}
              صافي الدخل (Net Income)
            </span>
            <span>{formatCurrency(data.netIncome)}</span>
          </div>

          {/* Profit Margin */}
          <div className="flex justify-between items-center py-3 border-t border-gray-200 mt-4">
            <span className="text-gray-700 font-medium">هامش الربح الصافي (Net Profit Margin)</span>
            <span
              className={`font-bold text-lg ${
                profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {profitMargin.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Summary Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-blue-800 text-sm">
          <strong>ملاحظة:</strong> قائمة الدخل تُظهر الأداء المالي للشركة خلال الفترة المحددة. صافي
          الدخل الإيجابي يعني ربحاً، بينما القيمة السالبة تعني خسارة.
        </p>
      </div>
    </div>
  );
}
