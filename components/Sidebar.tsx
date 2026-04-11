'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ShoppingCart, 
  Package, 
  Users, 
  DollarSign, 
  FileText, 
  TrendingUp, 
  Factory, 
  Settings,
  ChevronDown,
  ChevronLeft,
  LayoutDashboard,
  BarChart3
} from 'lucide-react';
import { useState } from 'react';

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
    children: [
      { title: 'العملاء', icon: Users, href: '/sales/customers' },
      { title: 'فواتير بيع', icon: FileText, href: '/sales/invoices' },
      { title: 'أوامر بيع', icon: FileText, href: '/sales/orders' },
      { title: 'تقارير المبيعات', icon: TrendingUp, href: '/sales/reports' },
    ],
  },
  {
    title: 'المخزن',
    icon: Package,
    href: '/warehouse',
  },
  {
    title: 'المخزون',
    icon: Package,
    href: '/inventory',
  },
  {
    title: 'المحاسبة',
    icon: BarChart3,
    children: [
      { title: 'الملخص المالي', icon: DollarSign, href: '/accounting' },
      { title: 'القيود اليومية', icon: FileText, href: '/accounting/journal' },
      { title: 'قائمة الدخل', icon: TrendingUp, href: '/accounting/profit-loss' },
    ],
  },
  {
    title: 'التصنيع',
    icon: Factory,
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
  const isActive = item.href === pathname;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all duration-200 ${
            level === 0
              ? 'hover:bg-blue-50 hover:text-blue-600'
              : 'hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${level === 0 ? 'bg-blue-50' : 'bg-gray-100'}`}>
              <item.icon className="w-4 h-4" />
            </div>
            <span className="font-medium">{item.title}</span>
          </div>
          <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </div>
        </button>
        {isOpen && (
          <div className={`overflow-hidden transition-all duration-300 ${
            level === 0 ? 'bg-blue-50/30' : 'bg-gray-100/30'
          }`}>
            <div className="py-1">
              {item.children.map((child, index) => (
                <SidebarItem key={index} item={child} level={level + 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href || '#'}
      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
          : 'hover:bg-blue-50 hover:text-blue-600'
      } ${level > 0 ? 'pr-8' : ''} ${level > 1 ? 'pr-12' : ''}`}
    >
      <div className={`p-1.5 rounded-lg transition-colors ${
        isActive ? 'bg-white/20' : 'bg-blue-50'
      }`}>
        <item.icon className="w-4 h-4" />
      </div>
      <span className="font-medium">{item.title}</span>
      {isActive && (
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      )}
    </Link>
  );
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`fixed top-0 right-0 h-full bg-gradient-to-br from-white/95 to-gray-50/95 backdrop-blur-xl shadow-2xl transition-all duration-500 z-20 ${
      isCollapsed ? 'w-20' : 'w-64'
    }`}>
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 animate-shimmer" />
      </div>
      {/* Header */}
      <div className="relative p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className={`transition-all duration-500 ${isCollapsed ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            <h1 className="text-xl font-bold text-gray-900 mb-1">نظام ERP</h1>
            <p className="text-sm text-gray-600">مصنع البلاستيك</p>
          </div>
          <button
            onClick={toggleCollapse}
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-300 hover:scale-110 hover:rotate-180 backdrop-blur-sm"
          >
            <ChevronLeft className={`w-5 h-5 text-gray-600 transition-transform duration-500 ${
              isCollapsed ? 'rotate-180' : ''
            }`} />
          </button>
        </div>

        {/* Decorative Line */}
        <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse shadow-glow" />
      </div>

      {/* Navigation */}
      <nav className="py-4 px-2 custom-scrollbar overflow-y-auto">
        <div className="space-y-2">
          {menuItems.map((item, index) => (
            <div key={index} className="transform transition-all duration-300 hover:translate-x-1">
              <SidebarItem item={item} />
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
          <span className={`transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>النظام متصل</span>
        </div>
      </div>
    </div>
  );
}
