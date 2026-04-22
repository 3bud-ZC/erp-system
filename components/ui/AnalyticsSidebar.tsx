'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, ReactNode } from 'react';
import {
  LayoutDashboard, ShoppingCart, Package, Truck, Calculator, Factory, LineChart,
  ChevronRight, ChevronLeft,
} from 'lucide-react';

interface Item { href: string; label: string; icon: ReactNode; role?: string | string[] }

const ITEMS: Item[] = [
  { href: '/analytics', label: 'النظرة المالية', icon: <LayoutDashboard size={18} /> },
  { href: '/analytics/sales', label: 'المبيعات', icon: <ShoppingCart size={18} />, role: ['admin', 'manager', 'sales', 'accountant'] },
  { href: '/analytics/purchase', label: 'المشتريات', icon: <Truck size={18} />, role: ['admin', 'manager', 'accountant'] },
  { href: '/analytics/inventory', label: 'المخزون', icon: <Package size={18} />, role: ['admin', 'manager', 'warehouse'] },
  { href: '/analytics/accounting', label: 'المحاسبة', icon: <Calculator size={18} />, role: ['admin', 'manager', 'accountant'] },
  { href: '/analytics/production', label: 'الإنتاج', icon: <Factory size={18} />, role: ['admin', 'manager'] },
  { href: '/analytics/financial', label: 'التحليل المالي', icon: <LineChart size={18} />, role: ['admin', 'manager', 'accountant'] },
];

import { useApp } from '@/components/providers/AppProviders';

export default function AnalyticsSidebar() {
  const pathname = usePathname();
  const { user } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  const visible = ITEMS.filter(item => {
    if (!item.role) return true;
    if (!user) return true; // show while loading
    const roles = Array.isArray(item.role) ? item.role : [item.role];
    return roles.some(r => user.roles.includes(r));
  });

  return (
    <aside
      className={`${collapsed ? 'lg:w-16' : 'lg:w-60'} lg:h-screen lg:sticky lg:top-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-[width] duration-300 ease-out flex flex-col`}
    >
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-5 border-b border-gray-100 dark:border-gray-800`}>
        {!collapsed && (
          <Link href="/dashboard" className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            <span className="text-[color:var(--brand,#2563eb)]">ERP</span> Analytics
          </Link>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex w-7 h-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visible.map(item => {
          const active = pathname === item.href || (item.href !== '/analytics' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {active && <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-l-full bg-[color:var(--brand,#2563eb)]" />}
              <span className={`transition-transform ${active ? 'text-[color:var(--brand,#2563eb)] scale-110' : 'text-gray-400 dark:text-gray-500 group-hover:scale-105'}`}>{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 dark:text-gray-500">
          © {new Date().getFullYear()} ERP
        </div>
      )}
    </aside>
  );
}
