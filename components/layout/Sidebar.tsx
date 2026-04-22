'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Scale, 
  Package, 
  ShoppingCart, 
  ShoppingCart as PurchaseIcon,
  Users, 
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    title: 'Accounting',
    href: '/accounting',
    icon: <Scale className="w-5 h-5" />,
  },
  {
    title: 'Inventory',
    href: '/inventory',
    icon: <Package className="w-5 h-5" />,
  },
  {
    title: 'Sales',
    href: '/sales',
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    title: 'Purchases',
    href: '/purchases',
    icon: <PurchaseIcon className="w-5 h-5" />,
  },
  {
    title: 'Customers',
    href: '/customers',
    icon: <Users className="w-5 h-5" />,
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-40',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          {!collapsed && (
            <span className="text-xl font-bold">ERP System</span>
          )}
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-slate-700 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
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
                  collapsed && 'justify-center'
                )}
                title={collapsed ? item.title : undefined}
              >
                {item.icon}
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Tenant Info */}
        {!collapsed && (
          <div className="p-4 border-t border-slate-700">
            <div className="text-sm text-slate-400">
              <div className="font-medium text-white">Current Tenant</div>
              <div>Company Name</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
