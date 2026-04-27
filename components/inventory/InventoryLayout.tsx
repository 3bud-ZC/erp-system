'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Package, Warehouse, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tabs for the unified `/inventory` (المخازن) section.
 *
 * Mirrors `components/accounting/AccountingLayout.tsx`. The warehouses
 * page still lives at `/warehouses` (lots of internal links) so the tab
 * just points there directly.
 */
const INVENTORY_TABS = [
  { href: '/inventory',                    title: 'نظرة عامة',  icon: LayoutGrid },
  { href: '/inventory/products',           title: 'المنتجات',    icon: Package },
  { href: '/warehouses',                   title: 'المستودعات',  icon: Warehouse },
  { href: '/inventory/stock-adjustments',  title: 'تسوية المخزون', icon: ClipboardList },
] as const;

export function InventoryLayout({
  title,
  subtitle,
  toolbar,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-1.5 flex gap-1 overflow-x-auto">
        {INVENTORY_TABS.map(t => {
          // Exact match for the hub, prefix match for sub-routes.
          const active =
            t.href === '/inventory'
              ? pathname === '/inventory'
              : pathname === t.href || pathname?.startsWith(t.href + '/');
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
    </div>
  );
}
