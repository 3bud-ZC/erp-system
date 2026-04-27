'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch } from 'lucide-react';
import { useToast, Toast } from '@/components/ui/patterns';
import { Field, SelectField, TextAreaField, Section, FieldGrid } from '@/components/ui/modal';
import { EntityFormPage } from '@/components/forms/EntityFormPage';

export interface ProductionLineExisting {
  id:              string;
  code:            string;
  name:            string;
  capacityPerHour: number;
  description?:    string | null;
  status:          string;
}

const empty = {
  code:            '',
  name:            '',
  capacityPerHour: '',
  description:     '',
  status:          'active',
};

export function ProductionLineForm({
  mode,
  existing,
}: {
  mode:      'create' | 'edit';
  existing?: ProductionLineExisting;
}) {
  const router = useRouter();
  const [toast, showToast] = useToast();

  const [form, setForm] = useState(() =>
    existing
      ? {
          code:            existing.code,
          name:            existing.name,
          capacityPerHour: String(existing.capacityPerHour ?? ''),
          description:     existing.description ?? '',
          status:          existing.status,
        }
      : empty,
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.code.trim()) return setError('الرمز مطلوب');
    if (!form.name.trim()) return setError('الاسم مطلوب');

    setSaving(true);
    try {
      const payload = {
        code:            form.code.trim(),
        name:            form.name.trim(),
        capacityPerHour: parseFloat(form.capacityPerHour) || 0,
        description:     form.description.trim() || null,
        status:          form.status,
      };
      const res = await fetch('/api/production-lines', {
        method:      mode === 'create' ? 'POST' : 'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(mode === 'edit' ? { id: existing!.id, ...payload } : payload),
      });
      const j = await res.json();
      if (j.success) {
        showToast(mode === 'create' ? 'تم إنشاء خط الإنتاج' : 'تم تحديث الخط', 'success');
        setTimeout(() => router.push('/manufacturing/production-lines'), 600);
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
        title={mode === 'create' ? 'إنشاء خط إنتاج جديد' : 'تعديل خط الإنتاج'}
        subtitle={
          mode === 'create'
            ? 'أدخل بيانات خط الإنتاج والطاقة الإنتاجية'
            : existing?.name
        }
        backHref="/manufacturing/production-lines"
        icon={<GitBranch className="w-5 h-5" />}
        error={error}
        saving={saving}
        formId="line-form"
        primaryLabel={mode === 'create' ? 'حفظ الخط' : 'حفظ التعديلات'}
      >
        <form id="line-form" onSubmit={handleSubmit} className="space-y-5">
          <Section title="البيانات الأساسية" subtitle="الرمز والاسم والطاقة الإنتاجية">
            <FieldGrid>
              <Field label="الرمز" required value={form.code} placeholder="LINE-001"
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              <Field label="الاسم" required value={form.name} placeholder="خط الإنتاج الرئيسي"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Field label="الطاقة الإنتاجية (وحدة/ساعة)" type="number" min="0" step="0.01"
                value={form.capacityPerHour} placeholder="0"
                onChange={e => setForm(f => ({ ...f, capacityPerHour: e.target.value }))} />
              <SelectField label="الحالة" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
                <option value="maintenance">صيانة</option>
              </SelectField>
              <TextAreaField label="الوصف" rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="وصف مختصر للخط…"
                className="sm:col-span-2" />
            </FieldGrid>
          </Section>
        </form>
      </EntityFormPage>
    </>
  );
}
