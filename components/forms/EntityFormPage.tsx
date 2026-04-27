'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle } from 'lucide-react';

/**
 * EntityFormPage
 * --------------
 * Shared chrome for any "create / edit" entity page (customer, supplier,
 * product, warehouse, journal entry, expense, stock-adjustment, …).
 *
 * Mirrors the layout used by the sales/purchase invoice creation page so
 * every CRUD form across the app feels identical:
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ ⟵ العودة للقائمة   │   icon  العنوان              │
 *   │                    │         الـ subtitle          │
 *   ├──────────────────────────────────────────────────────┤
 *   │ <error banner if any>                                │
 *   │ <Section> الحقول… </Section>                          │
 *   │ <Section> الحقول… </Section>                          │
 *   ├──────────────────────────────────────────────────────┤
 *   │  [إلغاء]                              [حفظ الكيان]   │
 *   └──────────────────────────────────────────────────────┘
 *
 * The component is intentionally _layout only_ — children pass their own
 * `<Section>` cards (`@/components/ui/modal`) and form state.
 */

interface EntityFormPageProps {
  /** Big page title, e.g. "إنشاء عميل جديد". */
  title: string;
  /** Smaller helper text under the title. */
  subtitle?: string;
  /** Where the "العودة للقائمة" link should point. */
  backHref: string;
  backLabel?: string;
  /** Icon shown inside the gradient tile in the header. */
  icon?: React.ReactNode;
  /** Optional badge shown next to the title (e.g. status pill on edit). */
  badge?: React.ReactNode;
  /** Inline error message rendered above the form. */
  error?: string | null;
  /** Whether the primary action is currently saving. */
  saving?: boolean;
  /** Form ID — primary submit button is wired via this id. */
  formId: string;
  /** Primary submit-button label (defaults to "حفظ"). */
  primaryLabel?: string;
  /** Disabled state for the primary button. */
  primaryDisabled?: boolean;
  /** Optional secondary action shown next to "إلغاء". */
  secondary?: React.ReactNode;
  children: React.ReactNode;
}

export function EntityFormPage({
  title,
  subtitle,
  backHref,
  backLabel = 'العودة للقائمة',
  icon,
  badge,
  error,
  saving,
  formId,
  primaryLabel = 'حفظ',
  primaryDisabled,
  secondary,
  children,
}: EntityFormPageProps) {
  return (
    <div className="p-6 space-y-5 pb-24" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <Link
          href={backHref}
          className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
        >
          <ArrowRight className="w-4 h-4" /> {backLabel}
        </Link>
      </div>

      {/* Inline error banner */}
      {error && (
        <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Body — sectioned cards live here */}
      <div className="space-y-5 max-w-5xl">{children}</div>

      {/* Sticky footer */}
      <div
        className="fixed bottom-0 inset-x-0 lg:start-64 bg-white/95 backdrop-blur border-t border-slate-200 px-6 py-3 flex items-center justify-end gap-2 z-30"
        dir="rtl"
      >
        <Link
          href={backHref}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          إلغاء
        </Link>

        {secondary}

        <button
          type="submit"
          form={formId}
          disabled={saving || primaryDisabled}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all shadow-md shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'جاري الحفظ…' : primaryLabel}
        </button>
      </div>
    </div>
  );
}
