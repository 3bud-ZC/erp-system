'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { useToast, Toast } from '@/components/ui/patterns';
import { Field, SelectField, TextAreaField, Section, FieldGrid } from '@/components/ui/modal';
import { EntityFormPage } from '@/components/forms/EntityFormPage';

export interface ExpenseExisting {
  id:             string;
  date:           string;
  category:       string;
  amount:         number;
  description:    string;
  paymentMethod:  string;
}

const empty = {
  date:          new Date().toISOString().slice(0, 10),
  category:      '',
  amount:        '',
  description:   '',
  paymentMethod: 'نقدي',
};

export function ExpenseForm({
  mode,
  existing,
}: {
  mode:      'create' | 'edit';
  existing?: ExpenseExisting;
}) {
  const router = useRouter();
  const [toast, showToast] = useToast();

  const [form, setForm] = useState(() =>
    existing
      ? {
          date:          existing.date.slice(0, 10),
          category:      existing.category ?? '',
          amount:        String(existing.amount ?? ''),
          description:   existing.description ?? '',
          paymentMethod: existing.paymentMethod ?? 'نقدي',
        }
      : empty,
  );

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.category)            return setError('يجب اختيار التصنيف');
    if (!form.amount)              return setError('المبلغ مطلوب');
    if (!form.description.trim())  return setError('وصف المصروف مطلوب');

    const amt = Number(form.amount) || 0;
    if (amt <= 0)                  return setError('المبلغ يجب أن يكون أكبر من صفر');

    setSaving(true);
    try {
      const payload = {
        date:          form.date,
        category:      form.category,
        amount:        amt,
        total:         amt,
        description:   form.description.trim(),
        paymentMethod: form.paymentMethod,
      };

      const res = await fetch('/api/expenses', {
        method:      mode === 'create' ? 'POST' : 'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(mode === 'edit' ? { id: existing!.id, ...payload } : payload),
      });
      const j = await res.json();

      if (j.success) {
        showToast(mode === 'create' ? 'تم تسجيل المصروف' : 'تم تحديث المصروف', 'success');
        setTimeout(() => router.push('/accounting/finance'), 600);
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
        title={mode === 'create' ? 'تسجيل مصروف جديد' : 'تعديل المصروف'}
        subtitle={
          mode === 'create'
            ? 'أدخل تفاصيل المصروف وطريقة الدفع'
            : existing?.description
        }
        backHref="/accounting/finance"
        icon={<Receipt className="w-5 h-5" />}
        error={error}
        saving={saving}
        formId="expense-form"
        primaryLabel={mode === 'create' ? 'حفظ المصروف' : 'حفظ التعديلات'}
      >
        <form id="expense-form" onSubmit={handleSubmit} className="space-y-5">
          <Section title="بيانات المصروف" subtitle="التاريخ، التصنيف، المبلغ، والوصف">
            <FieldGrid>
              <Field label="التاريخ" type="date" required value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              <SelectField label="التصنيف" required value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">اختر التصنيف</option>
                <option value="رواتب">رواتب</option>
                <option value="إيجار">إيجار</option>
                <option value="كهرباء ومياه">كهرباء ومياه</option>
                <option value="صيانة">صيانة</option>
                <option value="مصروفات إدارية">مصروفات إدارية</option>
                <option value="نقل ومواصلات">نقل ومواصلات</option>
                <option value="مواد تشغيل">مواد تشغيل</option>
                <option value="أخرى">أخرى</option>
              </SelectField>
              <Field label="المبلغ (ج.م)" type="number" step="0.01" min="0" required
                value={form.amount} placeholder="0.00"
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              <TextAreaField label="الوصف" required rows={3} value={form.description}
                placeholder="تفاصيل المصروف…"
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </FieldGrid>
          </Section>

          <Section title="طريقة الدفع" subtitle="حدد كيف تم دفع المصروف">
            <FieldGrid>
              <SelectField label="طريقة الدفع" value={form.paymentMethod}
                className="sm:col-span-2"
                onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                <option value="نقدي">نقدي</option>
                <option value="بنك">بنك</option>
                <option value="شيك">شيك</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
              </SelectField>
            </FieldGrid>
          </Section>
        </form>
      </EntityFormPage>
    </>
  );
}
