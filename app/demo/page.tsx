'use client';

/**
 * Client Demo Display Board
 * /demo — clean, view-only summary for client demos
 * - KPIs (Revenue / Expenses / Net Profit)
 * - Charts (sales vs purchases trend, inventory breakdown)
 * - Tables (recent invoices, recent journal entries)
 *
 * Authenticated like the rest of the app. No edit actions exposed.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Wallet,
  BarChart3,
  Package,
  Users,
  Truck,
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
} from 'lucide-react';

interface DashboardData {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  salesTrend: number;
  purchasesTrend: number;
  expensesTrend: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  totalProducts: number;
  totalInventoryValue: number;
  chartData?: { labels: string[]; sales: number[]; purchases: number[] };
  inventoryData?: { rawMaterials: number; finishedGoods: number; packaging: number };
  recentActivities?: Array<{
    id: string; type: string; title: string; description: string;
    amount: number; date: string; status: string;
  }>;
  recentJournalEntries?: Array<{
    id: string; entryNumber: string; entryDate: string;
    description: string | null; totalDebit: number; totalCredit: number; isPosted: boolean;
  }>;
}

interface Counts {
  customers: number | null;
  suppliers: number | null;
  invoices: number | null;
}

const fmtMoney = (v: number) =>
  `${(v ?? 0).toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م`;

const fmtCount = (v: number) =>
  (v ?? 0).toLocaleString('ar-EG', { maximumFractionDigits: 0 });

const fmtDate = (d?: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

export default function DemoPage() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [counts, setCounts] = useState<Counts>({ customers: null, suppliers: null, invoices: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, custRes, suppRes, invRes] = await Promise.all([
        fetch('/api/dashboard', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch('/api/customers', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch('/api/suppliers', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetch('/api/sales-invoices', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      ]);

      if (dashRes?.success === false) {
        setError(dashRes.message || 'فشل تحميل البيانات');
      } else {
        setDash(dashRes?.data ?? dashRes);
      }
      const arr = (r: any) => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : null);
      setCounts({
        customers: arr(custRes)?.length ?? null,
        suppliers: arr(suppRes)?.length ?? null,
        invoices: arr(invRes)?.length ?? null,
      });
    } catch (e: any) {
      setError(e?.message || 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const trendChart = (dash?.chartData?.labels ?? []).map((label, i) => ({
    name: label,
    sales: dash?.chartData?.sales?.[i] ?? 0,
    purchases: dash?.chartData?.purchases?.[i] ?? 0,
  }));

  const inventoryPie = [
    { name: 'تام الصنع', value: dash?.inventoryData?.finishedGoods ?? 0 },
    { name: 'مواد خام', value: dash?.inventoryData?.rawMaterials ?? 0 },
    { name: 'تغليف', value: dash?.inventoryData?.packaging ?? 0 },
  ].filter((d) => d.value > 0);

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto p-5 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mb-2">
              <BarChart3 className="w-3.5 h-3.5" /> Client Demo · للعرض فقط
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
              ERP System — Client Demo Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1" dir="ltr" style={{ textAlign: 'right' }}>
              View-only financial and operational overview
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              ملخص حي للأداء المالي والتشغيلي — لا تتوفر إجراءات تعديل
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </button>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              فتح لوحة التحكم <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            title="إجمالي الإيرادات"
            subtitle="الشهر الحالي"
            value={fmtMoney(dash?.totalSales ?? 0)}
            trend={dash?.salesTrend}
            Icon={ShoppingCart}
            iconCls="bg-blue-50 text-blue-600"
            accentCls="bg-blue-500"
          />
          <KpiCard
            title="إجمالي المصروفات"
            subtitle="الشهر الحالي"
            value={fmtMoney((dash?.totalPurchases ?? 0) + (dash?.totalExpenses ?? 0))}
            trend={dash?.expensesTrend}
            Icon={Wallet}
            iconCls="bg-red-50 text-red-600"
            accentCls="bg-red-500"
          />
          <KpiCard
            title="صافي الربح"
            subtitle={`هامش الربح ${(dash?.profitMargin ?? 0).toFixed(1)}%`}
            value={fmtMoney(dash?.netProfit ?? 0)}
            Icon={(dash?.netProfit ?? 0) >= 0 ? BarChart3 : TrendingDown}
            iconCls={(dash?.netProfit ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
            accentCls={(dash?.netProfit ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-red-500'}
          />
          <KpiCard
            title="قيمة المخزون"
            subtitle={`${fmtCount(dash?.totalProducts ?? 0)} منتج`}
            value={fmtMoney(dash?.totalInventoryValue ?? 0)}
            Icon={Package}
            iconCls="bg-amber-50 text-amber-600"
            accentCls="bg-amber-500"
          />
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="العملاء" value={counts.customers} Icon={Users} cls="bg-purple-50 text-purple-600" />
          <StatTile label="الموردون" value={counts.suppliers} Icon={Truck} cls="bg-orange-50 text-orange-600" />
          <StatTile label="فواتير المبيعات" value={counts.invoices} Icon={FileText} cls="bg-blue-50 text-blue-600" />
          <StatTile label="المنتجات" value={dash?.totalProducts ?? null} Icon={Package} cls="bg-emerald-50 text-emerald-600" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Sales/Purchases Trend */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              المبيعات والمشتريات (آخر 6 أشهر)
            </h2>
            {trendChart.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={trendChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: any) => fmtMoney(Number(v) || 0)}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="sales" name="المبيعات" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="purchases" name="المشتريات" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="لا توجد بيانات للرسم" />
            )}
          </div>

          {/* Inventory Pie */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" />
              تركيبة المخزون
            </h2>
            {inventoryPie.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={inventoryPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {inventoryPie.map((entry, idx) => (
                        <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="لا توجد بيانات مخزون" />
            )}
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Recent Sales */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              آخر النشاطات
            </h2>
            {(dash?.recentActivities?.length ?? 0) > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400">العملية</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400">الجهة</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400">المبلغ</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(dash?.recentActivities ?? []).slice(0, 8).map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 text-slate-700 max-w-[180px] truncate">{a.title}</td>
                        <td className="py-2 text-slate-500 text-xs max-w-[140px] truncate">{a.description}</td>
                        <td className="py-2 font-semibold text-slate-900 tabular-nums">{fmtMoney(a.amount)}</td>
                        <td className="py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            a.status === 'completed'
                              ? 'text-green-700 bg-green-50'
                              : 'text-amber-700 bg-amber-50'
                          }`}>
                            {a.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {a.status === 'completed' ? 'مكتملة' : 'معلقة'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-400 text-sm py-8 text-center">لا توجد نشاطات</p>
            )}
          </div>

          {/* Recent Journal Entries */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              آخر قيود اليومية
            </h2>
            {(dash?.recentJournalEntries?.length ?? 0) > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400">رقم القيد</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400">التاريخ</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400">الوصف</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400">المبلغ</th>
                      <th className="pb-2 text-right text-xs font-semibold text-slate-400">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(dash?.recentJournalEntries ?? []).map((je) => (
                      <tr key={je.id}>
                        <td className="py-2 font-semibold text-indigo-600 tabular-nums">#{je.entryNumber}</td>
                        <td className="py-2 text-slate-500 text-xs tabular-nums">{fmtDate(je.entryDate)}</td>
                        <td className="py-2 text-slate-700 max-w-[180px] truncate">{je.description ?? '—'}</td>
                        <td className="py-2 font-semibold text-slate-900 tabular-nums">{fmtMoney(je.totalDebit)}</td>
                        <td className="py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            je.isPosted ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'
                          }`}>
                            {je.isPosted ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {je.isPosted ? 'مرحَّل' : 'مسودة'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-400 text-sm py-8 text-center">لا توجد قيود محاسبية</p>
            )}
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center text-xs text-slate-400 pt-4 pb-8">
          هذه الصفحة للعرض فقط — لا يمكن تعديل البيانات من هنا. جميع الأرقام محدّثة في الوقت الحقيقي.
        </div>
      </div>
    </div>
  );
}

/* ───── Sub-components ─────────────────────────────────────────────── */

function KpiCard({
  title, subtitle, value, trend, Icon, iconCls, accentCls,
}: {
  title: string;
  subtitle?: string;
  value: string;
  trend?: number;
  Icon: React.ElementType;
  iconCls: string;
  accentCls: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 overflow-hidden relative">
      <div className={`absolute top-0 left-0 right-0 h-1 ${accentCls}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${iconCls}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && trend !== 0 && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
              trend > 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
            }`}
          >
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
      <p className="text-sm font-medium text-slate-600 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function StatTile({
  label, value, Icon, cls,
}: { label: string; value: number | null; Icon: React.ElementType; cls: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${cls}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 tabular-nums">{value ?? '…'}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-72 flex items-center justify-center text-slate-400 text-sm">
      {label}
    </div>
  );
}
