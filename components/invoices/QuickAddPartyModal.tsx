'use client';

import { useState, useEffect } from 'react';
import { UserPlus } from 'lucide-react';
import { InvoiceConfig } from './InvoiceConfig';
import {
  Modal, Field, PrimaryButton, SecondaryButton, FormError, Section, FieldGrid,
} from '@/components/ui/modal';

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

  // Reset when opened.
  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setError(null);
    }
  }, [open]);

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
    <Modal
      open={open}
      onClose={onClose}
      title={`${config.addPartyLabel} جديد`}
      subtitle={`إضافة ${config.partyLabelGenitive} بدون مغادرة صفحة الفاتورة`}
      size="xl"
      icon={<UserPlus className="w-5 h-5" />}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={busy}>إلغاء</SecondaryButton>
          <PrimaryButton type="submit" form="quick-add-party-form" disabled={busy}>
            {busy ? 'جاري الحفظ…' : 'حفظ'}
          </PrimaryButton>
        </>
      }
    >
      <form id="quick-add-party-form" onSubmit={handleSubmit} className="space-y-5">
        <FormError>{error}</FormError>

        <Section title="البيانات الأساسية">
          <FieldGrid>
            <Field
              label={`اسم ${config.partyLabelGenitive}`}
              required
              value={form.nameAr}
              onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
              placeholder={config.kind === 'sales' ? 'مثلاً: شركة الأمل' : 'مثلاً: مؤسسة المورد'}
              className="sm:col-span-2"
            />
            <Field
              label="الرمز"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              placeholder={config.kind === 'sales' ? 'CUS-001 (يُولّد تلقائياً إن تُرك فارغاً)' : 'SUP-001 (يُولّد تلقائياً إن تُرك فارغاً)'}
              className="sm:col-span-2"
            />
          </FieldGrid>
        </Section>

        <Section title="بيانات التواصل">
          <FieldGrid>
            <Field
              label="رقم الهاتف"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="01xxxxxxxxx"
            />
            <Field
              label="البريد الإلكتروني"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="name@example.com"
            />
          </FieldGrid>
        </Section>
      </form>
    </Modal>
  );
}

function translateError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('p2002') || r.includes('unique')) return 'هذا الرمز مستخدم بالفعل، استخدم رمزاً آخر';
  if (r.includes('connect') || r.includes('fetch')) return 'تعذر الاتصال بالخادم';
  if (r.includes('permission') || r.includes('صلاحية')) return 'ليس لديك صلاحية لإضافة عميل/مورد جديد';
  return raw;
}
