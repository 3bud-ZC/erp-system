'use client';

import { ReactNode, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Inbox, RefreshCw, type LucideIcon } from 'lucide-react';

/**
 * Unified design-system patterns for the ERP UI.
 *
 * Use these components instead of inlining skeleton/empty/error/toast markup.
 * All patterns share the same visual language:
 *   - slate-* color scale
 *   - rounded-xl containers
 *   - bg-white shadow-sm border-slate-100 cards
 *   - Arabic-first messaging
 */

/* ─── Skeleton primitive ──────────────────────────────────── */
export function Sk({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-100 rounded ${className}`} />;
}

/* ─── Configurable table skeleton ─────────────────────────── */
export function TableSkeleton({ cols, rows = 6 }: { cols: string[]; rows?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-pulse">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex gap-6">
        {cols.map((w, i) => (
          <div key={i} className={`${w} h-3.5 bg-slate-200 rounded`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-slate-100 flex gap-6 items-center last:border-0">
          {cols.map((w, j) => (
            <div key={j} className={`${w} h-4 bg-slate-100 rounded`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Form skeleton ───────────────────────────────────────── */
export function FormSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-24 bg-slate-200 rounded" />
          <div className="h-9 w-full bg-slate-100 rounded-lg" />
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <div className="flex-1 h-10 bg-slate-200 rounded-lg" />
        <div className="flex-1 h-10 bg-slate-100 rounded-lg" />
      </div>
    </div>
  );
}

/* ─── Card grid skeleton ──────────────────────────────────── */
export function CardGridSkeleton({ cols = 2, count = 4 }: { cols?: number; count?: number }) {
  const colsCls = cols === 3 ? 'md:grid-cols-3' : cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-2';
  return (
    <div className={`grid grid-cols-1 ${colsCls} gap-4 animate-pulse`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-3">
          <div className="h-5 w-32 bg-slate-200 rounded" />
          <div className="h-3 w-24 bg-slate-100 rounded" />
          <div className="h-3 w-40 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ─── Empty state ─────────────────────────────────────────── */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-16 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-slate-600 font-medium">{title}</p>
      {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ─── Inline error banner with retry ──────────────────────── */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 font-medium hover:underline">
          <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
        </button>
      )}
    </div>
  );
}

/* ─── Full-state error block (for inside detail pages) ────── */
export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-16 text-center">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <AlertCircle className="w-6 h-6 text-red-500" />
      </div>
      <p className="text-red-600 font-medium">{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
        </button>
      )}
    </div>
  );
}

/* ─── Toast notification ──────────────────────────────────── */
type ToastState = { msg: string; type: 'success' | 'error' } | null;

export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium animate-slideIn
      ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {toast.msg}
    </div>
  );
}

/** Hook that returns `[toast, showToast]`. Toast auto-dismisses after 3s. */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => setToast(null), []);
  return [toast, showToast] as const;
}

/* ─── Page header ─────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
