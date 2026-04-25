'use client';

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
  Warehouse,
  Building2,
  BarChart3,
  ArrowUpDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    title: 'لوحة التحكم',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    title: 'العملاء',
    href: '/customers',
    icon: <Users className="w-5 h-5" />,
  },
  {
    title: 'الموردون',
    href: '/suppliers',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    title: 'المبيعات',
    href: '/sales/invoices',
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    title: 'المشتريات',
    href: '/purchases/invoices',
    icon: <Truck className="w-5 h-5" />,
  },
  {
    title: 'المنتجات',
    href: '/inventory/products',
    icon: <Package className="w-5 h-5" />,
  },
  {
    title: 'تسوية المخزون',
    href: '/inventory/stock-adjustments/new',
    icon: <ArrowUpDown className="w-5 h-5" />,
  },
  {
    title: 'المستودعات',
    href: '/warehouses',
    icon: <Warehouse className="w-5 h-5" />,
  },
  {
    title: 'دليل الحسابات',
    href: '/accounting/accounts',
    icon: <Scale className="w-5 h-5" />,
  },
  {
    title: 'القيود المحاسبية',
    href: '/accounting/journal-entries',
    icon: <Scale className="w-5 h-5" />,
  },
  {
    title: 'ميزان المراجعة',
    href: '/accounting/trial-balance',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    title: 'قائمة الدخل',
    href: '/accounting/reports/profit-loss',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    title: 'الميزانية العمومية',
    href: '/accounting/reports/balance-sheet',
    icon: <Scale className="w-5 h-5" />,
  },
  {
    title: 'تحليلات المبيعات',
    href: '/analytics/sales',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    title: 'التقارير المالية',
    href: '/analytics/financial',
    icon: <FileText className="w-5 h-5" />,
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

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
