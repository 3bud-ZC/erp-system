'use client';

import React from 'react';
import { Printer, Loader2, AlertCircle } from 'lucide-react';

/**
 * Wraps a single report with: filters bar (no-print) + print button (no-print)
 * + a printable header (only visible when printing) + the result content.
 *
 * Usage:
 *
 *   <ReportShell
 *     title="تقرير المبيعات"
 *     subtitle="..."
 *     filters={<>...</>}
 *     loading={loadingFlag}
 *     error={errMsg}
 *     periodLabel="من 2026-01-01 إلى 2026-01-31"
 *   >
 *     <Table />
 *   </ReportShell>
 */
export function ReportShell({
  title,
  subtitle,
  filters,
  periodLabel,
  loading,
  error,
  children,
  extraActions,
  companyName = 'تقرير',
}: {
  title:        string;
  subtitle?:    string;
  filters?:     React.ReactNode;
  periodLabel?: string;
  loading?:     boolean;
  error?:       string | null;
  children:     React.ReactNode;
  extraActions?: React.ReactNode;
  companyName?: string;
}) {
  return (
    <div className="space-y-5">
      {/* Print-only header */}
      <div className="hidden print:block border-b-2 border-slate-300 pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">{companyName}</div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <div className="text-xs text-slate-600 mt-0.5">{subtitle}</div>}
          </div>
          <div className="text-xs text-slate-500 text-left">
            {periodLabel && <div>{periodLabel}</div>}
            <div>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</div>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      {filters && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 no-print">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3 flex-1">{filters}</div>
            <div className="flex items-center gap-2">
              {extraActions}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-95 transition-all text-sm font-medium"
              >
                <Printer className="w-4 h-4" /> طباعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error / loading */}
      {error && (
        <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 no-print">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-500" />
          جاري تحميل التقرير…
        </div>
      ) : (
        <div className="space-y-4">{children}</div>
      )}
    </div>
  );
}

/* ─── Common helpers used by every report ─── */

export function ReportLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-700 mb-1.5">{children}</label>;
}

export const reportInputCls =
  'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]';

export function fmtMoneyEGP(v?: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

export function ReportSummaryCard({
  label, value, accent,
}: {
  label: string; value: string | number; accent?: string;
}) {
  return (
    <div className={`rounded-xl p-4 border ${accent ?? 'bg-white border-slate-200'}`}>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}
