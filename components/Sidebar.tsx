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
  ChevronLeft,
  FileText,
  DollarSign,
  Search,
  Menu,
  X,
} from 'lucide-react';

interface MenuItem {
  title: string;
  icon: any;
  href?: string;
  children?: MenuItem[];
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
    title: 'المخزون',
    icon: Package,
    href: '/inventory',
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
              ? 'bg-blue-50 text-blue-700' 
              : 'hover:bg-gray-100 text-gray-700'
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
          <div className="mt-1 mr-4 pr-4 border-r-2 border-gray-200">
            {item.children.map((child, index) => (
              <Link
                key={index}
                href={child.href || '#'}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 mb-1 ${
                  pathname === child.href
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <child.icon className="w-4 h-4" />
                <span>{child.title}</span>
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
          ? 'bg-blue-600 text-white shadow-md'
          : 'hover:bg-gray-100 text-gray-700'
      }`}
    >
      <item.icon className="w-5 h-5" />
      <span className="font-medium">{item.title}</span>
      {isActive && <div className="w-2 h-2 bg-white rounded-full mr-auto" />}
    </Link>
  );
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
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

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 right-0 h-full bg-white shadow-xl z-40 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-72'
        } ${isMobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
      >
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="p-5 flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex-1">
                <h1 className="text-xl font-bold text-gray-900">نظام ERP</h1>
                <p className="text-sm text-gray-500">مصنع البلاستيك</p>
              </div>
            )}
            <button
              onClick={toggleCollapse}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden lg:flex"
            >
              <ChevronRight className={`w-5 h-5 text-gray-600 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={toggleMobile}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          {/* Search Bar */}
          {!isCollapsed && (
            <div className="px-4 pb-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث..."
                  className="w-full pr-10 pl-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-3 overflow-y-auto h-[calc(100%-140px)]">
          {!isCollapsed ? (
            <div className="space-y-1">
              {menuItems.map((item, index) => (
                <SidebarItem key={index} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 pt-4">
              {menuItems.map((item, index) => (
                <Link
                  key={index}
                  href={item.href || '#'}
                  className={`p-3 rounded-xl transition-all ${
                    pathname === item.href || (item.href && pathname.startsWith(item.href))
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  title={item.title}
                >
                  <item.icon className="w-5 h-5" />
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {!isCollapsed && <span className="text-xs text-gray-500">النظام متصل</span>}
          </div>
        </div>
      </aside>
    </>
  );
}
