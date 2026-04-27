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
  size?:       'sm' | 'md' | 'lg' | 'xl';
  children:    React.ReactNode;
  footer?:     React.ReactNode;
}

const SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ open, onClose, title, size = 'md', children, footer }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      dir="rtl"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn(
          'bg-white rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/60 w-full overflow-hidden',
          SIZE[size],
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mx-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>

        {footer && (
          <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex gap-3 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
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
