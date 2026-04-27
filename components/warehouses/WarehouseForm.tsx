'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Warehouse } from 'lucide-react';
import { useToast, Toast } from '@/components/ui/patterns';
import { Field, Section, FieldGrid } from '@/components/ui/modal';
import { EntityFormPage } from '@/components/forms/EntityFormPage';

export interface WarehouseExisting {
  id:        string;
  code:      string;
  nameAr:    string;
  nameEn?:   string | null;
  address?:  string | null;
  phone?:    string | null;
  manager?:  string | null;
  isActive?: boolean;
}

const empty = { code: '', nameAr: '', nameEn: '', address: '', phone: '', manager: '' };

export function WarehouseForm({
  mode,
  existing,
}: {
  mode:      'create' | 'edit';
  existing?: WarehouseExisting;
}) {
  const router = useRouter();
  const [toast, showToast] = useToast();

  const [form, setForm] = useState(() =>
    existing
      ? {
          code:    existing.code,
          nameAr:  existing.nameAr,
          nameEn:  existing.nameEn  ?? '',
          address: existing.address ?? '',
          phone:   existing.phone   ?? '',
          manager: existing.manager ?? '',
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
              ...(form.nameEn  && { nameEn:  form.nameEn.trim() }),
              ...(form.address && { address: form.address.trim() }),
              ...(form.phone   && { phone:   form.phone.trim() }),
              ...(form.manager && { manager: form.manager.trim() }),
            }
          : {
              id:      existing!.id,
              code:    form.code.trim(),
              nameAr:  form.nameAr.trim(),
              nameEn:  form.nameEn.trim()  || null,
              address: form.address.trim() || null,
              phone:   form.phone.trim()   || null,
              manager: form.manager.trim() || null,
            };

      const res = await fetch('/api/warehouses', {
        method:      mode === 'create' ? 'POST' : 'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
      });
      const j = await res.json();

      if (j.success) {
        showToast(mode === 'create' ? 'تم إضافة المستودع بنجاح' : 'تم تحديث بيانات المستودع', 'success');
        setTimeout(() => router.push('/warehouses'), 600);
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
        title={mode === 'create' ? 'إنشاء مستودع جديد' : 'تعديل بيانات المستودع'}
        subtitle={
          mode === 'create'
            ? 'أدخل بيانات المستودع في الأقسام التالية'
            : existing?.nameAr
        }
        backHref="/warehouses"
        icon={<Warehouse className="w-5 h-5" />}
        error={error}
        saving={saving}
        formId="warehouse-form"
        primaryLabel={mode === 'create' ? 'حفظ المستودع' : 'حفظ التعديلات'}
      >
        <form id="warehouse-form" onSubmit={handleSubmit} className="space-y-5">
          <Section title="البيانات الأساسية" subtitle="الرمز والاسم ورقم الهاتف">
            <FieldGrid>
              <Field label="الرمز" required value={form.code} placeholder="WH-001"
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              <Field label="الهاتف" value={form.phone} placeholder="0501234567"
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <Field label="الاسم بالعربية" required value={form.nameAr} placeholder="المستودع الرئيسي"
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} />
              <Field label="الاسم بالإنجليزية" value={form.nameEn} placeholder="Main Warehouse (اختياري)"
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
            </FieldGrid>
          </Section>

          <Section title="العنوان والإدارة" subtitle="عنوان المستودع والمدير المسؤول">
            <FieldGrid>
              <Field label="العنوان" value={form.address} placeholder="القاهرة، مصر"
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              <Field label="المدير المسؤول" value={form.manager} placeholder="أحمد محمد"
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, manager: e.target.value }))} />
            </FieldGrid>
          </Section>
        </form>
      </EntityFormPage>
    </>
  );
}
