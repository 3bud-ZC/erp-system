'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Polished modal primitives used across all "add / edit / confirm"
 * dialogs in the dashboard. Designed with:
 *   - Generous rounded corners (`rounded-2xl`) and a soft, layered shadow
 *     so the dialog feels lifted from the backdrop.
 *   - Backdrop blur for depth, no harsh black overlay.
 *   - Click-outside and Escape-to-close behaviour.
 *   - RTL-first layout but works LTR too.
 */

interface ModalProps {
  open:        boolean;
  onClose:     () => void;
  title:       string;
  subtitle?:   string;
  size?:       'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  icon?:       React.ReactNode;
  children:    React.ReactNode;
  footer?:     React.ReactNode;
}

const SIZE = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  '2xl':'max-w-3xl',
  '3xl':'max-w-5xl',
};

export function Modal({ open, onClose, title, subtitle, size = 'lg', icon, children, footer }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm"
      dir="rtl"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn(
          'bg-slate-50 rounded-2xl shadow-2xl shadow-slate-900/25 ring-1 ring-slate-200/70',
          'w-full my-auto overflow-hidden flex flex-col max-h-[calc(100vh-3rem)]',
          SIZE[size],
        )}
      >
        {/* Header — gradient bar + title + close */}
        <div className="relative bg-gradient-to-l from-indigo-600 via-blue-600 to-blue-500 px-6 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-white shadow-inner ring-1 ring-white/20 flex-shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-base font-bold truncate">{title}</h2>
                {subtitle && (
                  <p className="text-xs text-blue-100 mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>

        {footer && (
          <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Card-style Section (same look as the invoice form) ── */

interface SectionProps {
  title?:    string;
  action?:   React.ReactNode;
  children:  React.ReactNode;
  className?: string;
}

export function Section({ title, action, children, className }: SectionProps) {
  return (
    <section className={cn(
      'bg-white rounded-xl shadow-sm border border-slate-200 p-5',
      className,
    )}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
          {title && <h3 className="text-sm font-semibold text-slate-700">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ───────── Responsive 2-col grid for fields ──────────────── */

export function FieldGrid({ children, cols = 2, className }: {
  children:  React.ReactNode;
  cols?:     1 | 2 | 3;
  className?: string;
}) {
  const map = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' };
  return <div className={cn('grid grid-cols-1 gap-4', map[cols], className)}>{children}</div>;
}

/* ───────── Form Field ────────────────────────────────────── */

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:     string;
  required?: boolean;
  error?:    string;
}

export function Field({ label, required, error, className, ...props }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        {...props}
        required={required}
        className={cn(
          'w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm placeholder:text-slate-400 transition-shadow',
          'focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500',
          'disabled:bg-slate-50 disabled:text-slate-500',
          error
            ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
            : 'border-slate-200 hover:border-slate-300',
          className,
        )}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

/* ───────── Select & TextArea ──────────────────────────────── */

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label:     string;
  required?: boolean;
}

export function SelectField({ label, required, className, children, ...props }: SelectProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <select
        {...props}
        required={required}
        className={cn(
          'w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm transition-shadow',
          'focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500',
          'hover:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500',
          className,
        )}
      >
        {children}
      </select>
    </div>
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label:     string;
  required?: boolean;
}

export function TextAreaField({ label, required, className, ...props }: TextAreaProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <textarea
        {...props}
        required={required}
        className={cn(
          'w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm placeholder:text-slate-400 transition-shadow resize-y',
          'focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500',
          'hover:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500',
          className,
        )}
      />
    </div>
  );
}

/* ───────── Buttons ────────────────────────────────────────── */

export function PrimaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'px-5 py-2.5 rounded-xl text-sm font-semibold text-white',
        'bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700',
        'shadow-md shadow-blue-500/20 transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    />
  );
}

export function SecondaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700',
        'bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
        'transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    />
  );
}

/* ───────── Inline form-error banner ───────────────────────── */

export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
      {children}
    </div>
  );
}
