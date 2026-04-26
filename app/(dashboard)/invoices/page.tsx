'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/fetcher';
import { TrendingUp, ShoppingCart, Plus, FileText, DollarSign, Clock } from 'lucide-react';
import { InvoiceLayout } from '@/components/invoices/InvoiceLayout';
import { fmtMoney, fmtDate, STATUS_LABELS } from '@/components/invoices/InvoiceConfig';
import { cn } from '@/lib/utils';

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  date?: string;
  createdAt?: string;
  total: number;
  grandTotal?: number;
  status?: string;
  paymentStatus?: string;
  customer?: { nameAr?: string };
  supplier?: { nameAr?: string };
}

export default function InvoicesOverviewPage() {
  const salesQ = useQuery({
    queryKey: ['sales', 'invoices', 'overview'],
    queryFn: () => apiGet<InvoiceRow[]>('/api/sales-invoices'),
    staleTime: 30_000,
  });
  const purchaseQ = useQuery({
    queryKey: ['purchases', 'invoices', 'overview'],
    queryFn: () => apiGet<InvoiceRow[]>('/api/purchase-invoices'),
    staleTime: 30_000,
  });

  const stats = useMemo(() => {
    const sales = salesQ.data ?? [];
    const purchases = purchaseQ.data ?? [];
    const sum = (arr: InvoiceRow[]) => arr.reduce((s, x) => s + Number(x.grandTotal ?? x.total ?? 0), 0);
    const pending = (arr: InvoiceRow[]) => arr.filter(x => x.status !== 'paid' && x.status !== 'cancelled');
    return {
      salesTotal:    sum(sales),
      salesCount:    sales.length,
      salesPending:  sum(pending(sales)),
      purchaseTotal: sum(purchases),
      purchaseCount: purchases.length,
      purchasePending: sum(pending(purchases)),
      recentSales:    [...sales].sort(byDateDesc).slice(0, 5),
      recentPurchases: [...purchases].sort(byDateDesc).slice(0, 5),
    };
  }, [salesQ.data, purchaseQ.data]);

  return (
    <InvoiceLayout
      title="الفواتير"
      subtitle="نظرة عامة على فواتير المبيعات والمشتريات"
      toolbar={
        <>
          <Link href="/invoices/sales/new"
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
            <Plus className="w-4 h-4" /> فاتورة مبيعات
          </Link>
          <Link href="/invoices/purchases/new"
            className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 shadow-sm">
            <Plus className="w-4 h-4" /> فاتورة مشتريات
          </Link>
        </>
      }
    >
      {/* Two big section cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          href="/invoices/sales"
          title="فواتير المبيعات"
          icon={TrendingUp}
          theme="blue"
          total={stats.salesTotal}
          count={stats.salesCount}
          pending={stats.salesPending}
          loading={salesQ.isLoading}
        />
        <SectionCard
          href="/invoices/purchases"
          title="فواتير المشتريات"
          icon={ShoppingCart}
          theme="amber"
          total={stats.purchaseTotal}
          count={stats.purchaseCount}
          pending={stats.purchasePending}
          loading={purchaseQ.isLoading}
        />
      </div>

      {/* Recent invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentList
          title="آخر فواتير المبيعات"
          rows={stats.recentSales}
          loading={salesQ.isLoading}
          routeBase="sales"
          partyKey="customer"
          empty="لا توجد فواتير مبيعات بعد"
        />
        <RecentList
          title="آخر فواتير المشتريات"
          rows={stats.recentPurchases}
          loading={purchaseQ.isLoading}
          routeBase="purchases"
          partyKey="supplier"
          empty="لا توجد فواتير مشتريات بعد"
        />
      </div>
    </InvoiceLayout>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────── */
function byDateDesc(a: InvoiceRow, b: InvoiceRow) {
  return new Date(b.date ?? b.createdAt ?? 0).getTime() - new Date(a.date ?? a.createdAt ?? 0).getTime();
}

function SectionCard({
  href, title, icon: Icon, theme, total, count, pending, loading,
}: {
  href: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  theme: 'blue' | 'amber';
  total: number;
  count: number;
  pending: number;
  loading: boolean;
}) {
  const palette = theme === 'blue'
    ? { bg: 'bg-blue-50', text: 'text-blue-600', accent: 'border-blue-500' }
    : { bg: 'bg-amber-50', text: 'text-amber-600', accent: 'border-amber-500' };
  return (
    <Link href={href}
      className={cn(
        'block bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all p-5 border-r-4',
        palette.accent,
      )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', palette.bg)}>
          <Icon className={cn('w-6 h-6', palette.text)} />
        </div>
        <span className="text-xs text-slate-400 hover:text-slate-700">عرض كل الفواتير ←</span>
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-3">{title}</h3>
      {loading ? (
        <div className="h-16 bg-slate-100 rounded animate-pulse" />
      ) : (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Mini label="الإجمالي" value={fmtMoney(total)} />
          <Mini label="عدد الفواتير" value={String(count)} />
          <Mini label="قيد الانتظار" value={fmtMoney(pending)} highlight={pending > 0 ? 'amber' : undefined} />
        </div>
      )}
    </Link>
  );
}

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: 'amber' }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn(
        'text-sm font-semibold mt-0.5 tabular-nums',
        highlight === 'amber' ? 'text-amber-700' : 'text-slate-900',
      )}>{value}</p>
    </div>
  );
}

function RecentList({
  title, rows, loading, routeBase, partyKey, empty,
}: {
  title: string;
  rows: InvoiceRow[];
  loading: boolean;
  routeBase: 'sales' | 'purchases';
  partyKey: 'customer' | 'supplier';
  empty: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-slate-400" /> {title}
      </h3>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map(inv => {
            const status = STATUS_LABELS[inv.status ?? ''] ?? STATUS_LABELS.pending;
            const partyName = partyKey === 'customer' ? inv.customer : inv.supplier;
            return (
              <li key={inv.id}>
                <Link href={`/invoices/${routeBase}/${inv.id}`}
                  className="flex items-center justify-between gap-3 py-2 hover:bg-slate-50 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-blue-600 truncate">{inv.invoiceNumber}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {partyName?.nameAr ?? '—'} · {fmtDate(inv.date ?? inv.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border', status.cls)}>
                      {status.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {fmtMoney(inv.grandTotal ?? inv.total)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
