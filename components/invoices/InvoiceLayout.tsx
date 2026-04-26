'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, TrendingUp, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared chrome for the unified Invoices section.
 *
 * Renders the page title + tab strip with three entries:
 *   - Overview     /invoices
 *   - Sales        /invoices/sales
 *   - Purchases    /invoices/purchases
 *
 * Each invoice page wraps its filters / KPIs / tables in this layout so
 * navigation stays consistent across the whole `/invoices/*` tree.
 */

const TABS = [
  { href: '/invoices',           title: 'نظرة عامة',         icon: LayoutDashboard },
  { href: '/invoices/sales',     title: 'فواتير المبيعات',  icon: TrendingUp },
  { href: '/invoices/purchases', title: 'فواتير المشتريات', icon: ShoppingCart },
];

export function InvoiceLayout({
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
        {toolbar && <div className="flex items-center gap-2 flex-wrap">{toolbar}</div>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 flex gap-1 overflow-x-auto">
        {TABS.map(t => {
          // Exact match for the overview tab; prefix match for the deeper ones.
          const active = t.href === '/invoices'
            ? pathname === '/invoices'
            : pathname === t.href || pathname?.startsWith(t.href + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'flex-1 min-w-[140px] flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg text-sm transition-colors',
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
