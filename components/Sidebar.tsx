'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  BarChart3,
  Factory,
  Settings,
  ChevronRight,
  Search,
  Menu,
  X,
  Home,
  Building2,
  Boxes,
  Layers,
  Calculator,
  FileText,
  DollarSign,
  ArrowLeftRight,
} from 'lucide-react';

interface MenuItem {
  title: string;
  icon: any;
  href?: string;
  children?: MenuItem[];
  count?: number;
}

const menuItems: MenuItem[] = [
  {
    title: 'لوحة التحكم',
    icon: LayoutDashboard,
    href: '/',
  },
  {
    title: 'المشتريات',
    icon: ShoppingCart,
    href: '/purchases',
    children: [
      { title: 'الموردين', icon: Users, href: '/purchases/suppliers' },
      { title: 'فواتير شراء', icon: FileText, href: '/purchases/invoices' },
      { title: 'أوامر شراء', icon: FileText, href: '/purchases/orders' },
      { title: 'المصروفات', icon: DollarSign, href: '/purchases/expenses' },
      { title: 'تقارير المشتريات', icon: TrendingUp, href: '/purchases/reports' },
    ],
  },
  {
    title: 'المبيعات',
    icon: TrendingUp,
    href: '/sales',
    children: [
      { title: 'العملاء', icon: Users, href: '/sales/customers' },
      { title: 'فواتير بيع', icon: FileText, href: '/sales/invoices' },
      { title: 'أوامر بيع', icon: FileText, href: '/sales/orders' },
      { title: 'تقارير المبيعات', icon: TrendingUp, href: '/sales/reports' },
    ],
  },
  {
    title: 'إعدادات المخازن',
    icon: Boxes,
    href: '/inventory',
    children: [
      { title: 'المخازن', icon: Home, href: '/inventory/warehouses', count: 0 },
      { title: 'الشركات', icon: Building2, href: '/inventory/companies', count: 0 },
      { title: 'مجموعات الأصناف', icon: Layers, href: '/inventory/groups', count: 0 },
      { title: 'الوحدات', icon: Calculator, href: '/inventory/units', count: 0 },
      { title: 'الأصناف', icon: Package, href: '/inventory', count: 0 },
    ],
  },
  {
    title: 'المحاسبة',
    icon: BarChart3,
    href: '/accounting',
    children: [
      { title: 'الملخص المالي', icon: DollarSign, href: '/accounting' },
      { title: 'القيود اليومية', icon: FileText, href: '/accounting/journal' },
      { title: 'قائمة الدخل', icon: TrendingUp, href: '/accounting/profit-loss' },
    ],
  },
  {
    title: 'التصنيع',
    icon: Factory,
    href: '/manufacturing',
    children: [
      { title: 'أوامر إنتاج', icon: FileText, href: '/manufacturing/production-orders' },
      { title: 'عمليات الإنتاج', icon: Settings, href: '/manufacturing/operations' },
      { title: 'دراسة التكاليف', icon: DollarSign, href: '/manufacturing/cost-study' },
    ],
  },
];

function SidebarItem({ item, level = 0 }: { item: MenuItem; level?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isActive = item.href === pathname || (item.href && pathname.startsWith(item.href + '/'));
  const hasActiveChild = item.children?.some(child => 
    child.href === pathname || (child.href && pathname.startsWith(child.href))
  );

  // Auto-open if has active child
  const shouldBeOpen = isOpen || hasActiveChild;

  if (item.children) {
    return (
      <div className="mb-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
            hasActiveChild 
              ? 'bg-blue-600 text-white' 
              : 'hover:bg-blue-700/50 text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.title}</span>
          </div>
          <ChevronRight 
            className={`w-4 h-4 transition-transform duration-200 ${shouldBeOpen ? 'rotate-90' : ''}`} 
          />
        </button>
        
        {shouldBeOpen && (
          <div className="mt-1 mr-4">
            {item.children.map((child, index) => (
              <Link
                key={index}
                href={child.href || '#'}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-all duration-200 mb-1 ${
                  pathname === child.href
                    ? 'bg-blue-400/30 text-white'
                    : 'hover:bg-blue-700/30 text-blue-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span>{child.title}</span>
                </div>
                {child.count !== undefined && (
                  <span className="text-xs bg-blue-800/50 px-2 py-0.5 rounded">
                    {child.count.toString().padStart(2, '0')}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href || '#'}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 mb-1 ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'hover:bg-blue-700/50 text-white'
      }`}
    >
      <item.icon className="w-5 h-5" />
      <span className="font-medium">{item.title}</span>
    </Link>
  );
}

export default function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={toggleMobile}
        className="fixed top-4 right-4 z-50 lg:hidden bg-blue-600 text-white p-3 rounded-lg shadow-lg"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Dark Blue Theme matching images */}
      <aside 
        className={`fixed top-0 right-0 h-full bg-gradient-to-b from-slate-800 to-slate-900 z-40 transition-all duration-300 w-72 shadow-2xl ${
          isMobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">نظام ERP</h1>
              <p className="text-sm text-slate-400">مصنع البلاستيك</p>
            </div>
            <button
              onClick={toggleMobile}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors lg:hidden"
            >
              <X className="w-5 h-5 text-slate-300" />
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="بحث..."
                className="w-full pr-10 pl-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 overflow-y-auto h-[calc(100%-140px)]">
          <div className="space-y-1">
            {menuItems.map((item, index) => (
              <SidebarItem key={index} item={item} />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700 bg-slate-900">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-slate-400">النظام متصل</span>
          </div>
        </div>
      </aside>
    </>
  );
}
