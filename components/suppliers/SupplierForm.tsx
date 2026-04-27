'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Truck } from 'lucide-react';
import { useToast, Toast } from '@/components/ui/patterns';
import { Field, Section, FieldGrid } from '@/components/ui/modal';
import { EntityFormPage } from '@/components/forms/EntityFormPage';

export interface SupplierExisting {
  id:           string;
  code:         string;
  nameAr:       string;
  nameEn?:      string | null;
  email?:       string | null;
  phone?:       string | null;
  creditLimit?: number | null;
}

const empty = { code: '', nameAr: '', nameEn: '', email: '', phone: '', creditLimit: '' };

export function SupplierForm({
  mode,
  existing,
}: {
  mode:      'create' | 'edit';
  existing?: SupplierExisting;
}) {
  const router = useRouter();
  const [toast, showToast] = useToast();

  const [form, setForm] = useState(() =>
    existing
      ? {
          code:        existing.code,
          nameAr:      existing.nameAr,
          nameEn:      existing.nameEn ?? '',
          email:       existing.email ?? '',
          phone:       existing.phone ?? '',
          creditLimit: existing.creditLimit != null ? String(existing.creditLimit) : '',
        }
      : empty,
  );

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.code.trim())   return setError('الرمز مطلوب');
    if (!form.nameAr.trim()) return setError('الاسم بالعربية مطلوب');

    setSaving(true);
    try {
      const payload =
        mode === 'create'
          ? {
              code:   form.code.trim(),
              nameAr: form.nameAr.trim(),
              ...(form.nameEn      && { nameEn:      form.nameEn.trim() }),
              ...(form.email       && { email:       form.email.trim() }),
              ...(form.phone       && { phone:       form.phone.trim() }),
              ...(form.creditLimit && { creditLimit: Number(form.creditLimit) }),
            }
          : {
              id:          existing!.id,
              code:        form.code.trim(),
              nameAr:      form.nameAr.trim(),
              nameEn:      form.nameEn.trim() || null,
              email:       form.email.trim()  || null,
              phone:       form.phone.trim()  || null,
              creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
            };

      const res = await fetch('/api/suppliers', {
        method:      mode === 'create' ? 'POST' : 'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
      });
      const j = await res.json();

      if (j.success) {
        showToast(mode === 'create' ? 'تم إضافة المورد بنجاح' : 'تم تحديث بيانات المورد', 'success');
        setTimeout(() => router.push('/suppliers'), 600);
      } else {
        setError(j.message || j.error || 'فشل الحفظ');
        setSaving(false);
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
      setSaving(false);
    }
  }

  return (
    <>
      <Toast toast={toast} />
      <EntityFormPage
        title={mode === 'create' ? 'إنشاء مورد جديد' : 'تعديل بيانات المورد'}
        subtitle={
          mode === 'create'
            ? 'أدخل بيانات المورد في الأقسام التالية'
            : existing?.nameAr
        }
        backHref="/suppliers"
        icon={<Truck className="w-5 h-5" />}
        error={error}
        saving={saving}
        formId="supplier-form"
        primaryLabel={mode === 'create' ? 'حفظ المورد' : 'حفظ التعديلات'}
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-5">
          <Section title="البيانات الأساسية" subtitle="الرمز والاسم وحد الائتمان">
            <FieldGrid>
              <Field label="الرمز" required value={form.code} placeholder="SUP-001"
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              <Field label="حد الائتمان (ج.م)" type="number" min="0" value={form.creditLimit} placeholder="0"
                onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} />
              <Field label="الاسم بالعربية" required value={form.nameAr} placeholder="شركة التوريد"
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} />
              <Field label="الاسم بالإنجليزية" value={form.nameEn} placeholder="Supply Company (اختياري)"
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
            </FieldGrid>
          </Section>

          <Section title="بيانات التواصل" subtitle="الهاتف والبريد الإلكتروني">
            <FieldGrid>
              <Field label="الهاتف" value={form.phone} placeholder="0501234567"
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <Field label="البريد الإلكتروني" type="email" value={form.email} placeholder="info@supplier.com"
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </FieldGrid>
          </Section>
        </form>
      </EntityFormPage>
    </>
  );
}
