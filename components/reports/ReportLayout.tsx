'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, ShoppingCart, Users, Package, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

const REPORT_TABS = [
  { href: '/reports/sales',     title: 'تقارير المبيعات',  icon: TrendingUp },
  { href: '/reports/purchases', title: 'تقارير المشتريات', icon: ShoppingCart },
  { href: '/reports/customers', title: 'تقارير العملاء',   icon: Users },
  { href: '/reports/inventory', title: 'تقارير المخزون',   icon: Package },
];

/**
 * Shared chrome for the four report sub-pages.
 *
 * Renders the page title + the four-tab strip. Each report page wraps its
 * filters / KPIs / charts / tables in this layout so the navigation stays
 * consistent across `/reports/*` routes.
 */
export function ReportLayout({
  title,
  subtitle,
  toolbar,
  children,
}: {
  title: string;
  subtitle?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="p-6 space-y-5 report-print-root" dir="rtl">
      {/* Print-only header — shown only when the user prints */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
        <p className="text-xs text-slate-500 mt-1">
          تاريخ الطباعة: {new Date().toLocaleString('ar-EG')}
        </p>
      </div>

      <div className="flex items-end justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {toolbar}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 active:scale-95 transition-all text-sm text-slate-700"
            title="طباعة التقرير"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
        </div>
      </div>

      {/* Tab strip — hidden on print */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-1.5 flex gap-1 overflow-x-auto print:hidden">
        {REPORT_TABS.map(t => {
          const active = pathname === t.href || pathname?.startsWith(t.href + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'flex-1 min-w-[140px] flex items-center gap-2 justify-center px-4 py-2.5 rounded-xl text-sm transition-all',
                active
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-semibold shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon className="w-4 h-4" />
              {t.title}
            </Link>
          );
        })}
      </div>

      {children}

      {/* Print-friendly tweaks */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { background: #fff !important; }
          /* hide app shell (sidebar / topbar) when printing */
          aside, nav, header { display: none !important; }
          .report-print-root { padding: 0 !important; }
          /* expand main area so the report uses full width */
          main, [class*="flex-1"] { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}

/** Common KPI card used across the report pages. */
export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  color = 'blue',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon?: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'slate';
}) {
  const palette: Record<string, { tile: string; ring: string; glow: string }> = {
    blue:   { tile: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white',     ring: 'ring-blue-100',    glow: 'shadow-blue-500/15' },
    green:  { tile: 'bg-gradient-to-br from-emerald-500 to-green-600 text-white',   ring: 'ring-emerald-100', glow: 'shadow-emerald-500/15' },
    red:    { tile: 'bg-gradient-to-br from-rose-500 to-red-600 text-white',        ring: 'ring-rose-100',    glow: 'shadow-rose-500/15' },
    amber:  { tile: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white',    ring: 'ring-amber-100',   glow: 'shadow-amber-500/15' },
    purple: { tile: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white',   ring: 'ring-violet-100',  glow: 'shadow-violet-500/15' },
    slate:  { tile: 'bg-gradient-to-br from-slate-500 to-slate-700 text-white',     ring: 'ring-slate-100',   glow: 'shadow-slate-500/10' },
  };
  const p = palette[color];
  return (
    <div className={cn(
      'relative bg-white rounded-2xl border border-slate-200/80 p-4 transition-all',
      'shadow-sm hover:shadow-md hover:-translate-y-0.5',
      p.glow,
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          {trend != null && (
            <p className={cn('text-xs mt-1.5 font-semibold inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md',
              trend > 0 ? 'text-emerald-700 bg-emerald-50'
                : trend < 0 ? 'text-rose-700 bg-rose-50'
                : 'text-slate-600 bg-slate-50')}>
              {trend > 0 ? '▲' : trend < 0 ? '▼' : '—'} {Math.abs(trend).toFixed(1)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ring-4', p.tile, p.ring)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
