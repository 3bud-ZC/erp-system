'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  BookOpen,
  Wallet,
  ListTree,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tabs for the unified `/accounting/*` section.
 *
 * Mirrors the structure of `components/reports/ReportLayout.tsx` so the
 * accounting and reports sections share the same look-and-feel.
 */
const ACCOUNTING_TABS = [
  { href: '/accounting',                   title: 'نظرة عامة',      icon: LayoutGrid },
  { href: '/accounting/journal-entries',   title: 'القيود المحاسبية', icon: BookOpen },
  { href: '/accounting/finance',           title: 'المالية',          icon: Wallet },
  { href: '/accounting/chart-of-accounts', title: 'دليل الحسابات',    icon: ListTree },
  { href: '/accounting/trial-balance',     title: 'ميزان المراجعة',   icon: Scale },
] as const;

/**
 * Shared chrome for the accounting sub-pages.
 *
 * Renders the page title + the five-tab strip. Each accounting page wraps
 * its filters / KPIs / tables in this layout so navigation stays
 * consistent across `/accounting/*` routes.
 */
export function AccountingLayout({
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
    <div className="p-6 space-y-5" dir="rtl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      {/* Tab strip */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 flex gap-1 overflow-x-auto">
        {ACCOUNTING_TABS.map(t => {
          // Exact match for the hub, prefix match for sub-routes.
          const active =
            t.href === '/accounting'
              ? pathname === '/accounting'
              : pathname === t.href || pathname?.startsWith(t.href + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'flex-1 min-w-[120px] flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <Icon className="w-4 h-4" />
              {t.title}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}

/**
 * Common KPI card. Re-exported here so accounting pages don't need to
 * reach into `components/reports/*`. Same visual contract as
 * `components/reports/ReportLayout.tsx#KpiCard`.
 */
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
  const palette: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
    amber:  'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    slate:  'bg-slate-100 text-slate-600',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 truncate">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          {trend != null && (
            <p className={cn('text-xs mt-1 font-medium',
              trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-slate-500')}>
              {trend > 0 ? '▲' : trend < 0 ? '▼' : '—'} {Math.abs(trend).toFixed(1)}% عن الفترة السابقة
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', palette[color])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
