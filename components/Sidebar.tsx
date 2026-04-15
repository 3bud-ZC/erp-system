'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  Link2,
  Workflow,
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
    href: '/dashboard',
  },
  {
    title: 'المخزون',
    icon: Package,
    href: '/dashboard/inventory',
    children: [
      { title: 'المنتجات', icon: Boxes, href: '/dashboard/inventory/products' },
      { title: 'المواد الخام', icon: Layers, href: '/dashboard/inventory/raw-materials' },
      { title: 'المخازن', icon: Building2, href: '/dashboard/inventory/warehouses' },
    ],
  },
  {
    title: 'المبيعات',
    icon: TrendingUp,
    href: '/dashboard/sales',
    children: [
      { title: 'العملاء', icon: Users, href: '/dashboard/sales/customers' },
      { title: 'فواتير بيع', icon: FileText, href: '/dashboard/sales/invoices' },
      { title: 'أوامر بيع', icon: FileText, href: '/dashboard/sales/orders' },
      { title: 'تقارير المبيعات', icon: BarChart3, href: '/dashboard/sales/reports' },
    ],
  },
  {
    title: 'المشتريات',
    icon: ShoppingCart,
    href: '/dashboard/purchases',
    children: [
      { title: 'الموردين', icon: Users, href: '/dashboard/purchases/suppliers' },
      { title: 'فواتير شراء', icon: FileText, href: '/dashboard/purchases/invoices' },
      { title: 'أوامر شراء', icon: FileText, href: '/dashboard/purchases/orders' },
      { title: 'المصروفات', icon: DollarSign, href: '/dashboard/purchases/expenses' },
      { title: 'تقارير المشتريات', icon: BarChart3, href: '/dashboard/purchases/reports' },
    ],
  },
  {
    title: 'التصنيع',
    icon: Factory,
    href: '/dashboard/manufacturing',
    children: [
      { title: 'أوامر إنتاج', icon: FileText, href: '/dashboard/manufacturing/production-orders' },
      { title: 'خطوط الإنتاج', icon: Workflow, href: '/dashboard/manufacturing/production-lines' },
      { title: 'تخصيص المنتجات', icon: Link2, href: '/dashboard/manufacturing/line-assignments' },
      { title: 'عمليات الإنتاج', icon: Settings, href: '/dashboard/manufacturing/operations' },
      { title: 'دراسة التكاليف', icon: Calculator, href: '/dashboard/manufacturing/cost-study' },
    ],
  },
];

function SidebarItem({ item, level = 0 }: { item: MenuItem; level?: number }) {
  const pathname = usePathname();
  const isActive = item.href === pathname;
  const hasActiveChild = item.children?.some(child => child.href === pathname);

  // Auto-open if has active child - use controlled state
  const [isOpen, setIsOpen] = useState(hasActiveChild);
  
  // Update isOpen when pathname changes
  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild]);

  const shouldBeOpen = isOpen;

  if (item.children) {
    return (
      <div className="mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`group w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02] ${
            hasActiveChild 
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30' 
              : 'hover:bg-slate-700/70 text-slate-200 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg transition-all duration-300 ${
              hasActiveChild ? 'bg-white/20' : 'group-hover:bg-slate-600/50'
            }`}>
              <item.icon className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm">{item.title}</span>
          </div>
          <ChevronRight 
            className={`w-4 h-4 transition-all duration-300 ${shouldBeOpen ? 'rotate-90' : ''}`} 
          />
        </button>
        
        <div className={`overflow-hidden transition-all duration-300 ${shouldBeOpen ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
          <div className="mr-2 space-y-1 border-r-2 border-slate-700/50 pr-2">
            {item.children.map((child, index) => (
              <Link
                key={index}
                href={child.href || '#'}
                className={`group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 transform hover:translate-x-[-4px] ${
                  pathname === child.href
                    ? 'bg-gradient-to-r from-blue-500/30 to-blue-600/20 text-white border-r-2 border-blue-400'
                    : 'hover:bg-slate-700/50 text-slate-300 hover:text-white'
                }`}
              >
                <child.icon className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                <span className="flex-1">{child.title}</span>
                {child.count !== undefined && (
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                    {child.count.toString().padStart(2, '0')}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href || '#'}
      className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-[1.02] mb-2 ${
        isActive
          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
          : 'hover:bg-slate-700/70 text-slate-200 hover:text-white'
      }`}
    >
      <div className={`p-1.5 rounded-lg transition-all duration-300 ${
        isActive ? 'bg-white/20' : 'group-hover:bg-slate-600/50'
      }`}>
        <item.icon className="w-4 h-4" />
      </div>
      <span className="font-semibold text-sm">{item.title}</span>
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
        <div className="p-5 border-b border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-transparent">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">نظام ERP</h1>
                  <p className="text-xs text-slate-400">مصنع البلاستيك</p>
                </div>
              </div>
            </div>
            <button
              onClick={toggleMobile}
              className="p-2 hover:bg-slate-700/70 rounded-lg transition-all duration-200 lg:hidden"
            >
              <X className="w-5 h-5 text-slate-300" />
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="بحث سريع..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-700/50 border border-slate-600/50 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 focus:bg-slate-700/70 transition-all duration-200"
            />
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
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50 bg-gradient-to-t from-slate-900 to-transparent backdrop-blur-sm">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75" />
              </div>
              <span className="text-xs text-slate-400 font-medium">متصل</span>
            </div>
            <span className="text-xs text-slate-500">v1.0.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
