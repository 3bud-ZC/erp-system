'use client';

import { useMemo, memo } from 'react';
import Link from 'next/link';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { queryKeys } from '@/lib/api/query-keys';
import {
  TrendingUp, TrendingDown, ShoppingCart, Package, DollarSign,
  FileText, Users, Truck, AlertTriangle, RefreshCw, ArrowLeft,
  Plus, UserPlus, BarChart3, Wallet, Clock, CheckCircle, XCircle,
  PackagePlus,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */
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
  lowStockDetails: { id: string; nameAr: string; stock: number; minStock?: number }[];
  totalProducts: number;
  recentActivities: {
    id: string; type: string; title: string;
    description: string; amount: number; date: string; status: string;
  }[];
  recentJournalEntries?: {
    id: string;
    entryNumber: string;
    entryDate: string;
    description: string | null;
    totalDebit: number;
    totalCredit: number;
    isPosted: boolean;
  }[];
  alerts: { id: string; type: string; title: string; description: string; severity: string }[];
}

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  date?: string;
  createdAt: string;
  total: number;
  grandTotal?: number;
  status: string;
  customer?: { nameAr: string };
}

/* ─── Helpers ────────────────────────────────────────────────────────── */
function fmt(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} م`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(1)} ألف`;
  return `${sign}${abs.toLocaleString('ar-EG', { maximumFractionDigits: 0 })}`;
}

function fmtDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short' }); }
  catch { return d; }
}

const statusMap: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  paid:      { label: 'مدفوعة', cls: 'text-green-700 bg-green-50',  Icon: CheckCircle },
  completed: { label: 'مكتملة', cls: 'text-blue-700 bg-blue-50',    Icon: CheckCircle },
  pending:   { label: 'معلقة',  cls: 'text-amber-700 bg-amber-50',  Icon: Clock },
  draft:     { label: 'مسودة',  cls: 'text-slate-600 bg-slate-100', Icon: Clock },
  cancelled: { label: 'ملغاة',  cls: 'text-red-700 bg-red-50',      Icon: XCircle },
};

/* ─── Skeleton ───────────────────────────────────────────────────────── */
function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
}

function SkKPI() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 overflow-hidden">
      <div className="h-1 -mx-5 -mt-5 mb-4 bg-slate-200 animate-pulse" />
      <div className="flex items-start justify-between mb-3">
        <Sk className="w-10 h-10 rounded-lg" />
        <Sk className="w-14 h-5 rounded-full" />
      </div>
      <Sk className="w-28 h-7 mb-2" />
      <Sk className="w-20 h-4 mb-1" />
      <Sk className="w-16 h-3" />
    </div>
  );
}

function SkStat() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
      <Sk className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Sk className="w-12 h-6" />
        <Sk className="w-20 h-3" />
      </div>
    </div>
  );
}

function SkRow() {
  return <Sk className="w-full h-10 mb-2 last:mb-0" />;
}

/* ─── KPI Card ───────────────────────────────────────────────────────── */
interface KPICardProps {
  title: string;
  subtitle?: string;
  value: string;
  trend?: number;
  Icon: React.ElementType;
  iconCls: string;
  accentCls: string;
}
const KPICard = memo(function KPICard({ title, subtitle, value, trend, Icon, iconCls, accentCls }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 overflow-hidden relative">
      {/* color accent stripe */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${accentCls}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${iconCls}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && trend !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend > 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
          }`}>
            {trend > 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
      <p className="text-sm font-medium text-slate-600 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
});

/* ─── Stat Pill ──────────────────────────────────────────────────────── */
const StatPill = memo(function StatPill({
  label, value, Icon, iconCls, href,
}: { label: string; value: number | string; Icon: React.ElementType; iconCls: string; href?: string }) {
  const inner = (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center gap-3 hover:shadow-md hover:border-slate-200 transition-all">
      <div className={`p-2 rounded-lg ${iconCls} flex-shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : <div>{inner}</div>;
});

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const qc = useQueryClient();

  const results = useQueries({
    queries: [
      { queryKey: queryKeys.dashboard,      queryFn: () => apiGet<DashboardData>('/api/dashboard'),       staleTime: 30_000 },
      { queryKey: queryKeys.customers,      queryFn: () => apiGet<any[]>('/api/customers'),               staleTime: 60_000 },
      { queryKey: queryKeys.suppliers,      queryFn: () => apiGet<any[]>('/api/suppliers'),               staleTime: 60_000 },
      { queryKey: queryKeys.salesInvoices,  queryFn: () => apiGet<SalesInvoice[]>('/api/sales-invoices'), staleTime: 30_000 },
    ],
  });
  const [dashQ, custQ, suppQ, salesQ] = results;

  const dash          = dashQ.data ?? null;
  const customerCount = custQ.data ? custQ.data.length : null;
  const supplierCount = suppQ.data ? suppQ.data.length : null;
  const invoices      = salesQ.data ?? null;

  const loading    = results.some(r => r.isLoading);
  const refreshing = results.some(r => r.isFetching && !r.isLoading);
  const error      = dashQ.error ? (dashQ.error as Error).message : null;

  const load = (_isRefresh = false) => {
    qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    qc.invalidateQueries({ queryKey: queryKeys.customers });
    qc.invalidateQueries({ queryKey: queryKeys.suppliers });
    qc.invalidateQueries({ queryKey: queryKeys.salesInvoices });
  };

  /* derived values — memoized to avoid recomputing on unrelated re-renders */
  const unpaid     = useMemo(() => invoices?.filter(i => i.status === 'pending' || i.status === 'draft') ?? [], [invoices]);
  const recentInvs = useMemo(() => invoices?.slice(0, 7) ?? [], [invoices]);
  const profit     = useMemo(() => dash?.netProfit ?? 0, [dash]);
  const profitable = useMemo(() => profit >= 0, [profit]);

  /* ── Loading skeleton ─────────────────────────────────────────────── */
  if (loading) return (
    <div dir="rtl" className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5"><Sk className="w-36 h-7" /><Sk className="w-52 h-4" /></div>
        <Sk className="w-24 h-9 rounded-lg" />
      </div>

      {/* KPI skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <SkKPI key={i} />)}
      </div>

      {/* Stat pill skeletons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => <SkStat key={i} />)}
      </div>

      {/* Alerts + table skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-2">
          <Sk className="w-20 h-5 mb-3" />
          {[0,1,2].map(i => <Sk key={i} className="w-full h-14 rounded-xl" />)}
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <Sk className="w-32 h-5 mb-4" />
          {[0,1,2,3,4,5].map(i => <SkRow key={i} />)}
        </div>
      </div>

      {/* Actions skeleton */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <Sk className="w-28 h-5 mb-4" />
        <div className="flex gap-3">{[0,1,2,3].map(i => <Sk key={i} className="w-36 h-10 rounded-lg" />)}</div>
      </div>
    </div>
  );

  /* ── Error ────────────────────────────────────────────────────────── */
  if (error) return (
    <div dir="rtl" className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertTriangle className="w-8 h-8 text-amber-400" />
      <p className="text-slate-600 text-sm">{error}</p>
      <button onClick={() => load()}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
        إعادة المحاولة
      </button>
    </div>
  );

  /* ── Dashboard ────────────────────────────────────────────────────── */
  return (
    <div dir="rtl" className="space-y-5 pb-8">

      {/* ══ Page Header ══════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">لوحة التحكم</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('ar-EG', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* ══ Step 1 — KPI Cards ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="إجمالي المبيعات"
          subtitle="الشهر الحالي"
          value={`${fmt(dash?.totalSales ?? 0)} ج.م`}
          trend={dash?.salesTrend}
          Icon={ShoppingCart}
          iconCls="bg-blue-50 text-blue-600"
          accentCls="bg-blue-500"
        />
        <KPICard
          title="إجمالي المشتريات"
          subtitle="الشهر الحالي"
          value={`${fmt(dash?.totalPurchases ?? 0)} ج.م`}
          trend={dash?.purchasesTrend}
          Icon={Truck}
          iconCls="bg-orange-50 text-orange-600"
          accentCls="bg-orange-500"
        />
        <KPICard
          title="إجمالي المصروفات"
          subtitle="الشهر الحالي"
          value={`${fmt(dash?.totalExpenses ?? 0)} ج.م`}
          trend={dash?.expensesTrend}
          Icon={Wallet}
          iconCls="bg-red-50 text-red-600"
          accentCls="bg-red-500"
        />
        <KPICard
          title="صافي الربح"
          subtitle={`هامش الربح ${dash?.profitMargin ?? 0}%`}
          value={`${fmt(profit)} ج.م`}
          Icon={profitable ? BarChart3 : TrendingDown}
          iconCls={profitable ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
          accentCls={profitable ? 'bg-emerald-500' : 'bg-red-500'}
        />
      </div>

      {/* ══ Step 2 — Quick Stats ═════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatPill
          label="إجمالي فواتير المبيعات"
          value={invoices?.length ?? '…'}
          Icon={FileText}
          iconCls="bg-blue-50 text-blue-600"
          href="/invoices/sales"
        />
        <StatPill
          label="العملاء"
          value={customerCount ?? '…'}
          Icon={Users}
          iconCls="bg-purple-50 text-purple-600"
          href="/customers"
        />
        <StatPill
          label="الموردون"
          value={supplierCount ?? '…'}
          Icon={Truck}
          iconCls="bg-orange-50 text-orange-600"
          href="/suppliers"
        />
        <StatPill
          label="المنتجات"
          value={dash?.totalProducts ?? '…'}
          Icon={Package}
          iconCls="bg-emerald-50 text-emerald-600"
          href="/inventory/products"
        />
      </div>

      {/* ══ Step 3+4 — Alerts + Recent Invoices ══════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Alerts Panel ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            تنبيهات
            {(unpaid.length + (dash?.lowStockDetails?.length ?? 0)) > 0 && (
              <span className="mr-auto inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full">
                {Math.min(unpaid.length + (dash?.lowStockDetails?.length ?? 0), 9)}
              </span>
            )}
          </h2>

          <div className="space-y-2.5">

            {/* Unpaid invoices alert */}
            {unpaid.length > 0 ? (
              <Link href="/invoices/sales"
                className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors group block">
                <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center mt-0.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800">فواتير غير مدفوعة</p>
                  <p className="text-xs text-amber-600 mt-0.5">{unpaid.length} فاتورة تنتظر التسوية</p>
                </div>
                <ArrowLeft className="w-4 h-4 text-amber-400 flex-shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <p className="text-xs text-green-700 font-medium">لا توجد فواتير معلقة ✓</p>
              </div>
            )}

            {/* Low stock alert */}
            {dash?.lowStockDetails && dash.lowStockDetails.length > 0 ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-800">مخزون منخفض</p>
                    <p className="text-xs text-red-500">{dash.lowStockDetails.length} منتج أقل من الحد الأدنى</p>
                  </div>
                </div>
                <div className="space-y-1.5 mr-10">
                  {dash.lowStockDetails.slice(0, 4).map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span className="text-xs text-red-700 truncate">{p.nameAr}</span>
                      <span className="text-xs font-bold text-red-800 flex-shrink-0 mr-2 tabular-nums">
                        {p.stock} / {p.minStock ?? 0}
                      </span>
                    </div>
                  ))}
                  {dash.lowStockDetails.length > 4 && (
                    <Link href="/inventory/products" className="text-xs text-red-500 hover:underline block mt-1">
                      + {dash.lowStockDetails.length - 4} منتجات أخرى…
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <p className="text-xs text-green-700 font-medium">مستويات المخزون طبيعية ✓</p>
              </div>
            )}

            {/* Extra API alerts */}
            {dash?.alerts
              .filter(a => a.type !== 'stock' && a.type !== 'invoice')
              .map(alert => (
                <div key={alert.id}
                  className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p>{alert.description}</p>
                </div>
              ))}
          </div>
        </div>

        {/* ── Step 4 — Recent Invoices Table ── */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              آخر فواتير المبيعات
            </h2>
            <Link href="/invoices/sales"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium">
              عرض الكل <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          {recentInvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mb-3">
                <FileText className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-slate-400 text-sm font-medium">لا توجد فواتير حتى الآن</p>
              <p className="text-slate-400 text-xs mt-1">أنشئ أول فاتورة مبيعات لعرضها هنا</p>
              <Link href="/invoices/sales/new"
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                <Plus className="w-3 h-3" /> إنشاء فاتورة
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2.5 text-right text-xs font-semibold text-slate-400 pr-1">الفاتورة</th>
                    <th className="pb-2.5 text-right text-xs font-semibold text-slate-400">العميل</th>
                    <th className="pb-2.5 text-right text-xs font-semibold text-slate-400">التاريخ</th>
                    <th className="pb-2.5 text-right text-xs font-semibold text-slate-400">المبلغ</th>
                    <th className="pb-2.5 text-right text-xs font-semibold text-slate-400">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentInvs.map(inv => {
                    const st = statusMap[inv.status] ?? {
                      label: inv.status,
                      cls: 'text-slate-600 bg-slate-100',
                      Icon: Clock,
                    };
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-2.5 pr-1">
                          <Link href={`/invoices/sales/${inv.id}`}
                            className="font-semibold text-blue-600 hover:underline tabular-nums">
                            #{inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="py-2.5 text-slate-700 max-w-[130px] truncate">
                          {inv.customer?.nameAr ?? '—'}
                        </td>
                        <td className="py-2.5 text-slate-500 text-xs tabular-nums">
                          {fmtDate(inv.date ?? inv.createdAt)}
                        </td>
                        <td className="py-2.5 font-semibold text-slate-900 tabular-nums">
                          {fmt(inv.grandTotal ?? inv.total)} ج.م
                        </td>
                        <td className="py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                            <st.Icon className="w-3 h-3 flex-shrink-0" />
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══ Recent Journal Entries ═════════════════════════════════════ */}
      {dash?.recentJournalEntries && dash.recentJournalEntries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              آخر قيود اليومية
            </h2>
            <Link href="/accounting"
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-medium">
              عرض الكل <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2.5 text-right text-xs font-semibold text-slate-400 pr-1">رقم القيد</th>
                  <th className="pb-2.5 text-right text-xs font-semibold text-slate-400">التاريخ</th>
                  <th className="pb-2.5 text-right text-xs font-semibold text-slate-400">الوصف</th>
                  <th className="pb-2.5 text-right text-xs font-semibold text-slate-400">المبلغ</th>
                  <th className="pb-2.5 text-right text-xs font-semibold text-slate-400">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dash.recentJournalEntries.map(je => (
                  <tr key={je.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 pr-1 font-semibold text-indigo-600 tabular-nums">
                      #{je.entryNumber}
                    </td>
                    <td className="py-2.5 text-slate-500 text-xs tabular-nums">
                      {fmtDate(je.entryDate)}
                    </td>
                    <td className="py-2.5 text-slate-700 max-w-[260px] truncate">
                      {je.description ?? '—'}
                    </td>
                    <td className="py-2.5 font-semibold text-slate-900 tabular-nums">
                      {fmt(je.totalDebit)} ج.م
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        je.isPosted ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'
                      }`}>
                        {je.isPosted
                          ? <CheckCircle className="w-3 h-3 flex-shrink-0" />
                          : <Clock className="w-3 h-3 flex-shrink-0" />}
                        {je.isPosted ? 'مرحَّل' : 'مسودة'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Step 5 — Quick Actions ════════════════════════════════════ */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-slate-500" />
          إجراءات سريعة
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/invoices/sales/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <FileText className="w-4 h-4" /> إنشاء فاتورة مبيعات
          </Link>
          <Link href="/invoices/purchases/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors shadow-sm">
            <ShoppingCart className="w-4 h-4" /> إنشاء فاتورة مشتريات
          </Link>
          <Link href="/customers"
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors border border-slate-200">
            <UserPlus className="w-4 h-4 text-purple-500" /> إضافة عميل
          </Link>
          <Link href="/suppliers"
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors border border-slate-200">
            <Truck className="w-4 h-4 text-orange-500" /> إضافة مورد
          </Link>
          <Link href="/inventory/products"
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors border border-slate-200">
            <PackagePlus className="w-4 h-4 text-emerald-500" /> إضافة منتج
          </Link>
        </div>
      </div>

      {/* ══ Profit Summary Strip ══════════════════════════════════════ */}
      <div className="bg-gradient-to-l from-slate-800 via-slate-800 to-slate-900 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            ملخص الربحية — الشهر الحالي
          </p>
          <Link href="/reports"
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
            التقرير الكامل <ArrowLeft className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-xl font-bold text-green-400 tabular-nums">
              {fmt(dash?.grossProfit ?? 0)} ج.م
            </p>
            <p className="text-xs text-slate-400 mt-1">إجمالي الربح</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className={`text-xl font-bold tabular-nums ${profitable ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(profit)} ج.م
            </p>
            <p className="text-xs text-slate-400 mt-1">صافي الربح</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <p className={`text-xl font-bold tabular-nums ${profitable ? 'text-blue-400' : 'text-red-400'}`}>
              {dash?.profitMargin ?? 0}%
            </p>
            <p className="text-xs text-slate-400 mt-1">هامش الربح</p>
          </div>
        </div>
      </div>

    </div>
  );
}
