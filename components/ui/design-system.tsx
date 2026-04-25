/**
 * UNIFIED DESIGN SYSTEM
 * 
 * Consistent UI components used across the entire ERP system
 * to ensure visual consistency and professional appearance.
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

// ============================================================================
// UNIFIED BUTTON STYLES
// ============================================================================

export const buttonStyles = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
  success: 'bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
  danger: 'bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
  ghost: 'hover:bg-slate-100 text-slate-700 font-medium px-4 py-2 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
};

// ============================================================================
// UNIFIED CARD STYLES
// ============================================================================

export const cardStyles = {
  base: 'bg-white rounded-xl shadow-sm border border-slate-100 p-6',
  compact: 'bg-white rounded-xl shadow-sm border border-slate-100 p-4',
  hover: 'bg-white rounded-xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow duration-150',
};

// ============================================================================
// UNIFIED INPUT STYLES
// ============================================================================

export const inputStyles = {
  base: 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500',
  error: 'w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent',
};

// ============================================================================
// UNIFIED TABLE STYLES
// ============================================================================

export const tableStyles = {
  wrapper: 'overflow-x-auto rounded-lg border border-slate-200',
  table: 'w-full',
  thead: 'bg-slate-50 border-b border-slate-200',
  th: 'px-4 py-3 text-right text-sm font-semibold text-slate-700',
  tbody: 'divide-y divide-slate-100',
  tr: 'hover:bg-slate-50 transition-colors duration-100',
  td: 'px-4 py-3 text-sm text-slate-600',
};

// ============================================================================
// UNIFIED BADGE STYLES
// ============================================================================

export const badgeStyles = {
  success: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800',
  warning: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800',
  danger: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800',
  info: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800',
  neutral: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800',
};

// ============================================================================
// UNIFIED LOADING SKELETON
// ============================================================================

export function Skeleton({ className = '', width = 'w-full', height = 'h-4' }: { className?: string; width?: string; height?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${width} ${height} ${className}`} />;
}

// ============================================================================
// UNIFIED EMPTY STATE
// ============================================================================

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: { 
  icon: LucideIcon; 
  title: string; 
  description?: string; 
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-6 max-w-md">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}

// ============================================================================
// UNIFIED PAGE HEADER
// ============================================================================

export function PageHeader({ 
  title, 
  description, 
  actions 
}: { 
  title: string; 
  description?: string; 
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// UNIFIED STAT CARD
// ============================================================================

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  trend, 
  color = 'blue' 
}: { 
  icon: LucideIcon; 
  label: string; 
  value: string | number; 
  trend?: { value: number; label: string }; 
  color?: 'blue' | 'green' | 'red' | 'amber';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className={cardStyles.base}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

// ============================================================================
// UNIFIED LOADING SPINNER
// ============================================================================

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeClasses[size]} border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin`} />
    </div>
  );
}

// ============================================================================
// UNIFIED ALERT
// ============================================================================

export function Alert({ 
  type = 'info', 
  title, 
  message 
}: { 
  type?: 'success' | 'error' | 'warning' | 'info'; 
  title?: string; 
  message: string;
}) {
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  return (
    <div className={`border rounded-lg p-4 ${styles[type]}`}>
      {title && <div className="font-semibold mb-1">{title}</div>}
      <div className="text-sm">{message}</div>
    </div>
  );
}
