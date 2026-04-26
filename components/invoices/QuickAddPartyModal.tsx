'use client';

import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, UserPlus } from 'lucide-react';
import { InvoiceConfig } from './InvoiceConfig';

/**
 * In-form modal that lets the user add a new customer (sales invoice) or a
 * new supplier (purchase invoice) without leaving the invoice page.
 *
 * On success the parent receives the freshly-created party and is expected
 * to (a) prepend it to its dropdown options and (b) auto-select it.
 */

export interface CreatedParty {
  id: string;
  nameAr: string;
  phone?: string | null;
}

interface Props {
  config: InvoiceConfig;
  open: boolean;
  onClose: () => void;
  onCreated: (party: CreatedParty) => void;
}

const initialForm = { nameAr: '', code: '', phone: '', email: '' };

export function QuickAddPartyModal({ config, open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reset & focus when opened.
  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setError(null);
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nameAr.trim()) { setError('الاسم مطلوب'); return; }
    setBusy(true); setError(null);

    // Auto-generate a code if the user didn't type one.
    const code = form.code.trim() || `${config.kind === 'sales' ? 'CUS' : 'SUP'}-${Date.now().toString().slice(-6)}`;

    try {
      const res = await fetch(config.partyApi, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          nameAr: form.nameAr.trim(),
          ...(form.phone.trim() && { phone: form.phone.trim() }),
          ...(form.email.trim() && { email: form.email.trim() }),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.success === false) {
        const raw = j.message || j.error || `فشل الحفظ (HTTP ${res.status})`;
        setError(translateError(raw));
        return;
      }
      const created: CreatedParty = j.data ?? {};
      if (!created.id) {
        setError('استجابة غير متوقعة من الخادم');
        return;
      }
      onCreated(created);
      onClose();
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-slate-800 text-sm">{config.addPartyLabel} جديد</h3>
          </div>
          <button onClick={onClose} disabled={busy}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Field label={`اسم ${config.partyLabelGenitive} *`}>
            <input ref={firstInputRef} required value={form.nameAr}
              onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
              placeholder={config.kind === 'sales' ? 'مثلاً: شركة الأمل' : 'مثلاً: مؤسسة المورد'}
              className={inputCls} />
          </Field>

          <Field label="الرمز">
            <input value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder={config.kind === 'sales' ? 'CUS-001 (يُولّد تلقائياً إن تُرك فارغاً)' : 'SUP-001 (يُولّد تلقائياً إن تُرك فارغاً)'}
              className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="رقم الهاتف">
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="01xxxxxxxxx" className={inputCls} />
            </Field>
            <Field label="البريد الإلكتروني">
              <input type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="name@example.com" className={inputCls} />
            </Field>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} disabled={busy}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 disabled:opacity-50">
              إلغاء
            </button>
            <button type="submit" disabled={busy}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 min-w-[110px] justify-center">
              {busy && <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {busy ? 'جاري الحفظ…' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function translateError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('p2002') || r.includes('unique')) return 'هذا الرمز مستخدم بالفعل، استخدم رمزاً آخر';
  if (r.includes('connect') || r.includes('fetch')) return 'تعذر الاتصال بالخادم';
  if (r.includes('permission') || r.includes('صلاحية')) return 'ليس لديك صلاحية لإضافة عميل/مورد جديد';
  return raw;
}
