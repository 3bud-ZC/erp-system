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
  X,
  Menu
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
      { title: 'فواتير الشراء', icon: FileText, href: '/purchases/invoices' },
      { title: 'أوامر الشراء', icon: FileText, href: '/purchases/orders' },
      { title: 'المصروفات', icon: DollarSign, href: '/purchases/expenses' },
      { title: 'تقارير المشتريات', icon: TrendingUp, href: '/purchases/reports' },
    ],
  },
  {
    title: 'المبيعات',
    icon: TrendingUp,
    children: [
      { title: 'العملاء', icon: Users, href: '/sales/customers' },
      { title: 'فواتير البيع', icon: FileText, href: '/sales/invoices' },
      { title: 'أوامر البيع', icon: FileText, href: '/sales/orders' },
      { title: 'تقارير المبيعات', icon: TrendingUp, href: '/sales/reports' },
    ],
  },
  {
    title: 'المخزن',
    icon: Package,
    href: '/warehouse',
  },
  {
    title: 'التصنيع',
    icon: Factory,
    children: [
      { title: 'أوامر الإنتاج', icon: FileText, href: '/manufacturing/production-orders' },
      { title: 'عمليات الإنتاج', icon: Settings, href: '/manufacturing/operations' },
      { title: 'دراسة التكاليف', icon: DollarSign, href: '/manufacturing/cost-study' },
    ],
  },
];

function MobileSidebarItem({ item, level = 0, onItemClick }: { item: MenuItem; level?: number; onItemClick: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const isActive = item.href === pathname;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all duration-300 hover:translate-x-1 ${
            level === 0 
              ? 'hover:bg-gray-100' 
              : 'hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-all duration-300 ${level === 0 ? 'bg-gray-100 hover:scale-105' : 'bg-gray-50 hover:scale-105'}`}>
              <item.icon className="w-5 h-5 text-gray-600" />
            </div>
            <span className="font-medium text-gray-900">{item.title}</span>
          </div>
          <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </button>
        {isOpen && (
          <div className="bg-gray-50 animate-fadeIn">
            {item.children.map((child, index) => (
              <MobileSidebarItem key={index} item={child} level={level + 1} onItemClick={onItemClick} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href || '#'}
      onClick={onItemClick}
      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-300 hover:translate-x-1 ${
        isActive 
          ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600 shadow-lg' 
          : 'hover:bg-gray-100 text-gray-900'
      } ${level > 0 ? 'pr-12' : ''}`}
    >
      <div className={`p-2 rounded-lg transition-all duration-300 ${
        isActive ? 'bg-blue-100 scale-110' : 'bg-gray-100 hover:scale-105'
      }`}>
        <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
      </div>
      <span className="font-medium">{item.title}</span>
    </Link>
  );
}

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-all duration-500 ease-in-out
        lg:hidden
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="relative p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h1 className="text-xl font-bold">نظام ERP</h1>
              <p className="text-sm opacity-90">مصنع البلاستيك</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-all duration-300 hover:scale-110 hover:rotate-90"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="py-4 overflow-y-auto h-full pb-20">
          <div className="space-y-1">
            {menuItems.map((item, index) => (
              <div key={index} className="transform transition-all duration-300 hover:translate-x-1">
                <MobileSidebarItem item={item} onItemClick={onClose} />
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
            <span>النظام متصل</span>
          </div>
        </div>
      </div>
    </>
  );
}

// Mobile Menu Button Component
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <Menu className="w-6 h-6 text-gray-600" />
    </button>
  );
}
