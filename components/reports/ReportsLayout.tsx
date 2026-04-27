'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  PieChart, TrendingUp, ShoppingCart, Package, BookOpen, Users, Truck,
  Clock, Receipt, Factory,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tabs for the unified `/reports` (التقارير) section. Mirrors the look of
 * `InventoryLayout` / `ManufacturingLayout`. Hidden when printing via the
 * `no-print` class.
 */
const TABS = [
  { href: '/reports',                      title: 'نظرة عامة',         icon: PieChart },
  { href: '/reports/sales',                title: 'المبيعات',           icon: TrendingUp },
  { href: '/reports/purchases',            title: 'المشتريات',          icon: ShoppingCart },
  { href: '/reports/inventory',            title: 'المخازن',            icon: Package },
  { href: '/reports/expenses',             title: 'المصروفات',          icon: Receipt },
  { href: '/reports/customer-statement',   title: 'كشف عميل',          icon: Users },
  { href: '/reports/supplier-statement',   title: 'كشف مورد',          icon: Truck },
  { href: '/reports/aging',                title: 'الأعمار',             icon: Clock },
  { href: '/reports/profit-loss',          title: 'قائمة الدخل',         icon: BookOpen },
  { href: '/reports/balance-sheet',        title: 'الميزانية',           icon: BookOpen },
  { href: '/reports/manufacturing',        title: 'التصنيع',            icon: Factory },
] as const;

export function ReportsLayout({
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
    <div className="p-6 space-y-5 print-area" dir="rtl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {toolbar && <div className="flex items-center gap-2 flex-wrap no-print">{toolbar}</div>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-1.5 flex gap-1 overflow-x-auto no-print">
        {TABS.map(t => {
          const active =
            t.href === '/reports'
              ? pathname === '/reports'
              : pathname === t.href || pathname?.startsWith(t.href + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all',
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
