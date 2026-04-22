'use client';

import React from 'react';
import { WorkflowStatus } from '@/lib/erp-frontend-core/types';
import { getStatusConfig, formatStatus } from '@/lib/erp-frontend-core/workflow-utils';
import { CheckCircle, Clock, XCircle, FileCheck, Truck, PackageCheck } from 'lucide-react';

interface WorkflowStatusBadgeProps {
  status: WorkflowStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  language?: 'en' | 'ar';
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  CheckCircle,
  Clock,
  XCircle,
  FileCheck,
  Truck,
  PackageCheck,
  CheckCircle2: CheckCircle,
  Loader2: Clock,
  FileEdit: FileCheck,
  Wallet: FileCheck,
  Banknote: FileCheck,
  Ban: XCircle,
  Unlock: FileCheck,
  CalendarDays: Clock,
  Receipt: FileCheck,
  Play: FileCheck,
  ArrowRightLeft: FileCheck,
  Pencil: FileCheck,
  Trash2: XCircle,
  Printer: FileCheck,
  FileDown: FileCheck,
  BookOpen: FileCheck,
  BookText: FileCheck,
  ScrollText: FileCheck,
  Scale: FileCheck,
  FileSpreadsheet: FileCheck,
  Calendar: Clock,
  ListTree: FileCheck,
  ClipboardList: FileCheck,
  Workflow: FileCheck,
  GitBranch: FileCheck,
  Cog: FileCheck,
  Building2: FileCheck,
  Users: FileCheck,
  BarChart3: FileCheck,
  TrendingUp: FileCheck,
  TrendingDown: FileCheck,
  Package: FileCheck,
  PieChart: FileCheck,
  LayoutDashboard: FileCheck,
  ShoppingCart: FileCheck,
  ShoppingBag: FileCheck,
  Factory: FileCheck,
  Settings: FileCheck,
  Box: FileCheck,
  ArrowLeftRight: FileCheck,
  SlidersHorizontal: FileCheck,
};

export function WorkflowStatusBadge({
  status,
  showLabel = true,
  size = 'md',
  language = 'ar',
}: WorkflowStatusBadgeProps) {
  const config = getStatusConfig(status);
  const IconComponent = iconMap[config.icon] || FileCheck;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        sizeClasses[size]
      } ${config.bgColor} ${config.color}`}
    >
      <IconComponent className="w-4 h-4" />
      {showLabel && <span>{formatStatus(status, language)}</span>}
    </span>
  );
}
