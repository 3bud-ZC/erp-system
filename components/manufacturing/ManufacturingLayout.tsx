'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, Layers, GitBranch, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tabs for the unified `/manufacturing` (التصنيع) section.
 * Mirrors `InventoryLayout` and `AccountingLayout`.
 */
const TABS = [
  { href: '/manufacturing',                    title: 'نظرة عامة',     icon: LayoutDashboard },
  { href: '/manufacturing/production-orders',  title: 'أوامر الإنتاج', icon: ClipboardList },
  { href: '/manufacturing/bom',                title: 'قوائم المواد',  icon: Layers },
  { href: '/manufacturing/production-lines',   title: 'خطوط الإنتاج', icon: GitBranch },
  { href: '/manufacturing/waste',              title: 'الفاقد',         icon: AlertTriangle },
] as const;

export function ManufacturingLayout({
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
        {TABS.map(t => {
          const active =
            t.href === '/manufacturing'
              ? pathname === '/manufacturing'
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
