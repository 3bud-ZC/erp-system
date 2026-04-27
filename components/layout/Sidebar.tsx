'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  Factory,
  PieChart,
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
      { title: 'نظرة عامة',    href: '/inventory' },
      { title: 'المنتجات',     href: '/inventory/products' },
      { title: 'المستودعات',   href: '/warehouses' },
      { title: 'تسوية المخزون', href: '/inventory/stock-adjustments' },
    ],
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
    title: 'التصنيع',
    href: '/manufacturing',
    icon: <Factory className="w-5 h-5" />,
  },
  {
    title: 'المحاسبة',
    href: '/accounting',
    icon: <BookOpen className="w-5 h-5" />,
    children: [
      { title: 'نظرة عامة',     href: '/accounting' },
      { title: 'القيود المحاسبية', href: '/accounting/journal-entries' },
      { title: 'المالية',          href: '/accounting/finance' },
      { title: 'ميزان المراجعة',   href: '/accounting/trial-balance' },
    ],
  },
  {
    title: 'التقارير',
    href: '/reports',
    icon: <PieChart className="w-5 h-5" />,
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
    '/services':   pathname?.startsWith('/services')   || pathname?.startsWith('/customers')  || pathname?.startsWith('/suppliers')  || false,
    '/inventory':  pathname?.startsWith('/inventory')  || pathname?.startsWith('/warehouses') || false,
    '/invoices':   pathname?.startsWith('/invoices')   ?? false,
    '/accounting': pathname?.startsWith('/accounting') ?? false,
  }));
  const toggleGroup = (href: string) =>
    setOpenGroups(prev => ({ ...prev, [href]: !prev[href] }));

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full text-white transition-all duration-300 z-40 shadow-2xl',
        'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950',
        'border-l border-slate-800/60',
        collapsed ? 'w-16' : 'w-64'
      )}
      dir="rtl"
    >
      <div className="flex flex-col h-full">
        {/* Brand */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800/60">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-extrabold text-white shadow-lg shadow-blue-500/20">
                E
              </div>
              <div className="leading-tight">
                <div className="text-base font-bold text-white">نظام ERP</div>
                <div className="text-[10px] text-slate-400 tracking-wide uppercase">Business Suite</div>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 mx-auto rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-extrabold text-white shadow-lg shadow-blue-500/20">
              E
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="تبديل الشريط الجانبي"
          >
            {collapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
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
                <div key={item.href} className="relative">
                  {isActive && <span className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full bg-gradient-to-b from-blue-400 to-indigo-500" aria-hidden />}
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.href)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all flex-row-reverse justify-end',
                      isActive
                        ? 'bg-gradient-to-l from-blue-600/30 via-blue-600/10 to-transparent text-white shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white',
                    )}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown className={cn('w-4 h-4 transition-transform text-slate-400', isOpen ? 'rotate-180 text-blue-300' : '')} />
                    <span className="flex-1 text-sm font-medium text-right">{item.title}</span>
                    <span className={cn('shrink-0', isActive ? 'text-blue-300' : 'text-slate-400')}>{item.icon}</span>
                  </button>
                  {isOpen && (
                    <div className="mt-1 mr-3 pr-3 border-r border-slate-800 space-y-0.5">
                      {item.children!.map(child => {
                        const childActive = pathname === child.href || pathname?.startsWith(child.href + '/');
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'block px-3 py-1.5 rounded-lg text-xs transition-colors text-right',
                              childActive
                                ? 'bg-blue-500/15 text-blue-200 font-semibold'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/70',
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
              <div key={item.href} className="relative">
                {isActive && !collapsed && <span className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full bg-gradient-to-b from-blue-400 to-indigo-500" aria-hidden />}
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                    isActive
                      ? 'bg-gradient-to-l from-blue-600/30 via-blue-600/10 to-transparent text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white',
                    collapsed ? 'justify-center' : 'flex-row-reverse justify-end'
                  )}
                  title={item.title}
                >
                  <span className={cn('shrink-0', isActive ? 'text-blue-300' : 'text-slate-400')}>{item.icon}</span>
                  {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User / Tenant Info */}
        {!collapsed && (
          <div className="p-4 border-t border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md shadow-blue-500/20">
                {(user?.name?.[0] ?? 'م').toUpperCase()}
              </div>
              <div className="min-w-0 text-right">
                <div className="font-semibold text-white text-sm truncate">
                  {user?.name || 'المستخدم'}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {user?.email || ''}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
