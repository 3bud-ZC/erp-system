'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import {
  LayoutDashboard,
  Scale,
  Package,
  ShoppingCart,
  Truck,
  Users,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BarChart3,
  TrendingUp,
  PieChart,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavSubItem {
  title: string;
  href: string;
}

interface NavItem {
  title: string;
  /** Either a direct link or a parent for `children`. */
  href: string;
  icon: React.ReactNode;
  /** When present, the item becomes a collapsible group. */
  children?: NavSubItem[];
}

const navItems: NavItem[] = [
  {
    title: 'لوحة التحكم',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    title: 'الفواتير',
    href: '/invoices',
    icon: <FileText className="w-5 h-5" />,
    children: [
      { title: 'نظرة عامة',         href: '/invoices' },
      { title: 'فواتير المبيعات',  href: '/invoices/sales' },
      { title: 'فواتير المشتريات', href: '/invoices/purchases' },
    ],
  },
  {
    title: 'الخدمات',
    href: '/services',
    icon: <Users className="w-5 h-5" />,
    children: [
      { title: 'نظرة عامة', href: '/services' },
      { title: 'العملاء',    href: '/customers' },
      { title: 'الموردون',   href: '/suppliers' },
    ],
  },
  {
    title: 'المخازن',
    href: '/inventory',
    icon: <Package className="w-5 h-5" />,
    children: [
      { title: 'نظرة عامة',     href: '/inventory' },
      { title: 'المنتجات',       href: '/inventory/products' },
      { title: 'تسوية المخزون',  href: '/inventory/stock-adjustments/new' },
      { title: 'المستودعات',     href: '/warehouses' },
    ],
  },
  {
    title: 'المحاسبة',
    href: '/accounting',
    icon: <BookOpen className="w-5 h-5" />,
    children: [
      { title: 'نظرة عامة',     href: '/accounting' },
      { title: 'القيود المحاسبية', href: '/accounting/journal-entries' },
      { title: 'المالية',          href: '/accounting/finance' },
      { title: 'دليل الحسابات',    href: '/accounting/chart-of-accounts' },
      { title: 'ميزان المراجعة',   href: '/accounting/trial-balance' },
    ],
  },
  {
    title: 'التقارير',
    href: '/reports',
    icon: <PieChart className="w-5 h-5" />,
    children: [
      { title: 'تقارير المبيعات', href: '/reports/sales' },
      { title: 'تقارير المشتريات', href: '/reports/purchases' },
      { title: 'تقارير العملاء', href: '/reports/customers' },
      { title: 'تقارير المخزون', href: '/reports/inventory' },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  // افتح المجموعات ذات الصلة تلقائياً حسب المسار الحالي.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    '/invoices':   pathname?.startsWith('/invoices')   ?? false,
    '/services':   pathname?.startsWith('/services')   || pathname?.startsWith('/customers') || pathname?.startsWith('/suppliers') || false,
    '/inventory':  pathname?.startsWith('/inventory')  || pathname?.startsWith('/warehouses') || false,
    '/accounting': pathname?.startsWith('/accounting') ?? false,
    '/reports':    pathname?.startsWith('/reports')    ?? false,
  }));
  const toggleGroup = (href: string) =>
    setOpenGroups(prev => ({ ...prev, [href]: !prev[href] }));

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-40',
        collapsed ? 'w-16' : 'w-64'
      )}
      dir="rtl"
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          {!collapsed && (
            <span className="text-lg font-bold text-white">نظام ERP</span>
          )}
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-slate-700 transition-colors"
            aria-label="تبديل الشريط الجانبي"
          >
            {collapsed ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            const hasChildren = !!(item.children && item.children.length > 0);
            const isOpen = openGroups[item.href] ?? false;

            // Group with submenu — only when sidebar isn't collapsed.
            if (hasChildren && !collapsed) {
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.href)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors flex-row-reverse justify-end',
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                    )}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen ? 'rotate-180' : '')} />
                    <span className="flex-1 text-sm font-medium text-right">{item.title}</span>
                    {item.icon}
                  </button>
                  {isOpen && (
                    <div className="mt-1 ms-4 ps-2 border-r-2 border-slate-700 space-y-0.5">
                      {item.children!.map(child => {
                        const childActive = pathname === child.href || pathname?.startsWith(child.href + '/');
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'block px-3 py-1.5 rounded-md text-xs transition-colors text-right',
                              childActive
                                ? 'bg-blue-600/20 text-blue-200 font-medium'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800',
                            )}
                          >
                            {child.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Plain link (or collapsed sidebar)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  collapsed ? 'justify-center' : 'flex-row-reverse justify-end'
                )}
                title={item.title}
              >
                {item.icon}
                {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User / Tenant Info */}
        {!collapsed && (
          <div className="p-4 border-t border-slate-700 text-right">
            <div className="text-sm text-slate-400">
              <div className="font-semibold text-white truncate">
                {user?.name || 'المستخدم'}
              </div>
              <div className="truncate text-xs mt-0.5">
                {user?.email || ''}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
