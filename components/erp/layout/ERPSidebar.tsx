'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAllModules } from '@/lib/erp-frontend-core/module-registry';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard: require('lucide-react').LayoutDashboard,
  ShoppingCart: require('lucide-react').ShoppingCart,
  ShoppingBag: require('lucide-react').ShoppingBag,
  Package: require('lucide-react').Package,
  Calculator: require('lucide-react').Calculator,
  Factory: require('lucide-react').Factory,
  BarChart3: require('lucide-react').BarChart3,
  Settings: require('lucide-react').Settings,
  FileText: require('lucide-react').FileText,
  ClipboardList: require('lucide-react').ClipboardList,
  FileInvoice: require('lucide-react').FileInvoice,
  Undo2: require('lucide-react').Undo2,
  CreditCard: require('lucide-react').CreditCard,
  FileQuestion: require('lucide-react').FileQuestion,
  Box: require('lucide-react').Box,
  ArrowLeftRight: require('lucide-react').ArrowLeftRight,
  SlidersHorizontal: require('lucide-react').SlidersHorizontal,
  TrendingUp: require('lucide-react').TrendingUp,
  Truck: require('lucide-react').Truck,
  BookOpen: require('lucide-react').BookOpen,
  BookText: require('lucide-react').BookText,
  ScrollText: require('lucide-react').ScrollText,
  Scale: require('lucide-react').Scale,
  FileSpreadsheet: require('lucide-react').FileSpreadsheet,
  Calendar: require('lucide-react').Calendar,
  ListTree: require('lucide-react').ListTree,
  Workflow: require('lucide-react').Workflow,
  Cog: require('lucide-react').Cog,
  Building2: require('lucide-react').Building2,
  Users: require('lucide-react').Users,
  GitBranch: require('lucide-react').GitBranch,
  TrendingDown: require('lucide-react').TrendingDown,
  PieChart: require('lucide-react').PieChart,
  Clock: require('lucide-react').Clock,
  Wallet: require('lucide-react').Wallet,
  PackageCheck: require('lucide-react').PackageCheck,
};

export function ERPSidebar() {
  const pathname = usePathname();
  const modules = getAllModules();
  const [expandedModules, setExpandedModules] = useState<string[]>(['sales', 'purchases']);

  const toggleModule = (code: string) => {
    setExpandedModules(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  return (
    <aside className="w-64 bg-white border-l border-gray-200 min-h-[calc(100vh-4rem)] flex-shrink-0">
      <nav className="p-4 space-y-1">
        {modules.map((module) => {
          const Icon = iconMap[module.icon] || iconMap.LayoutDashboard;
          const isActive = pathname.startsWith(module.route);
          const isExpanded = expandedModules.includes(module.code);
          const hasSubModules = module.subModules && module.subModules.length > 0;

          return (
            <div key={module.code}>
              <Link
                href={module.route}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
                onClick={(e) => {
                  if (hasSubModules) {
                    e.preventDefault();
                    toggleModule(module.code);
                  }
                }}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{module.nameAr}</span>
                {hasSubModules && (
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                )}
              </Link>

              {/* Sub-modules */}
              {hasSubModules && isExpanded && (
                <div className="mr-4 mt-1 space-y-1 border-r-2 border-gray-100">
                  {module.subModules?.map((sub) => {
                    const SubIcon = iconMap[sub.icon] || iconMap.LayoutDashboard;
                    const isSubActive = pathname === sub.route;

                    return (
                      <Link
                        key={sub.code}
                        href={sub.route}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                          isSubActive
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        <SubIcon className="w-4 h-4" />
                        <span>{sub.nameAr}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
