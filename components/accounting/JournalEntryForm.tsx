'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { useToast, Toast } from '@/components/ui/patterns';
import { Field, Section, FieldGrid } from '@/components/ui/modal';
import { EntityFormPage } from '@/components/forms/EntityFormPage';

export interface JournalEntryExisting {
  id:           string;
  entryNumber?: string;
  entryDate?:   string;
  date?:        string;
  description?: string;
  isPosted?:    boolean;
  status?:      'DRAFT' | 'POSTED';
  lines?: {
    accountCode: string;
    description?: string | null;
    debit:       number;
    credit:      number;
  }[];
}

interface FormLine {
  accountCode: string;
  description: string;
  debit:       string;
  credit:      string;
}

const emptyLine = (): FormLine => ({ accountCode: '', description: '', debit: '', credit: '' });

export function JournalEntryForm({
  mode,
  existing,
}: {
  mode:      'create' | 'edit';
  existing?: JournalEntryExisting;
}) {
  const router = useRouter();
  const [toast, showToast] = useToast();

  const [entryDate, setEntryDate] = useState(() =>
    (existing?.entryDate || existing?.date || new Date().toISOString()).slice(0, 10),
  );
  const [description, setDescription] = useState(existing?.description ?? '');
  const [lines, setLines] = useState<FormLine[]>(() =>
    existing?.lines && existing.lines.length > 0
      ? existing.lines.map(l => ({
          accountCode: l.accountCode,
          description: l.description ?? '',
          debit:       String(l.debit  || ''),
          credit:      String(l.credit || ''),
        }))
      : [emptyLine(), emptyLine()],
  );

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01;

  function updateLine(i: number, field: keyof FormLine, val: string) {
    setLines(ls => ls.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  }
  function addLine() { setLines(ls => [...ls, emptyLine()]); }
  function removeLine(i: number) {
    if (lines.length > 2) setLines(ls => ls.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!balanced)                         return setError('مجموع المدين يجب أن يساوي مجموع الدائن');
    if (lines.some(l => !l.accountCode))   return setError('يجب إدخال رمز الحساب لكل سطر');

    setSaving(true);
    const payload = {
      entryDate,
      description,
      lines: lines.map(l => ({
        accountCode: l.accountCode,
        description: l.description,
        debit:       parseFloat(l.debit)  || 0,
        credit:      parseFloat(l.credit) || 0,
      })),
    };

    try {
      const res = await fetch('/api/journal-entries', {
        method:      mode === 'create' ? 'POST' : 'PUT',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(mode === 'edit' ? { id: existing!.id, ...payload } : payload),
      });
      const j = await res.json();

      if (j.success) {
        showToast(mode === 'create' ? 'تم إنشاء القيد بنجاح' : 'تم تحديث القيد', 'success');
        setTimeout(() => router.push('/accounting/journal-entries'), 600);
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
        title={mode === 'create' ? 'إنشاء قيد محاسبي جديد' : 'تعديل قيد محاسبي (مسودة)'}
        subtitle={
          mode === 'create'
            ? 'أدخل بيانات القيد وبنوده، يجب أن يكون متوازناً قبل الحفظ'
            : `قيد رقم ${existing?.entryNumber ?? existing?.id.slice(-6).toUpperCase()}`
        }
        backHref="/accounting/journal-entries"
        icon={<BookOpen className="w-5 h-5" />}
        error={error}
        saving={saving}
        formId="journal-entry-form"
        primaryDisabled={!balanced}
        primaryLabel={mode === 'create' ? 'حفظ القيد' : 'حفظ التعديلات'}
      >
        <form id="journal-entry-form" onSubmit={handleSubmit} className="space-y-5">
          <Section title="بيانات القيد" subtitle="التاريخ والبيان العام للقيد">
            <FieldGrid>
              <Field label="تاريخ القيد" required type="date" value={entryDate}
                onChange={e => setEntryDate(e.target.value)} />
              <Field label="البيان" required value={description} placeholder="وصف القيد"
                onChange={e => setDescription(e.target.value)} />
            </FieldGrid>
          </Section>

          <Section
            title="بنود القيد"
            subtitle="يجب أن يساوي مجموع المدين مجموع الدائن"
            action={
              <button type="button" onClick={addLine}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50">
                <Plus className="w-3.5 h-3.5" /> إضافة سطر
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-[20%]">رمز الحساب</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-[35%]">البيان</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500 w-[18%]">مدين</th>
                    <th className="px-3 py-2 text-left  text-xs font-semibold text-slate-500 w-[18%]">دائن</th>
                    <th className="w-[5%]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">
                        <input value={line.accountCode}
                          onChange={e => updateLine(i, 'accountCode', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="1001" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={line.description}
                          onChange={e => updateLine(i, 'description', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="وصف" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" value={line.debit}
                          onChange={e => updateLine(i, 'debit', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="0" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" value={line.credit}
                          onChange={e => updateLine(i, 'credit', e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="0" />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button type="button" onClick={() => removeLine(i)}
                          disabled={lines.length <= 2}
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-slate-600">الإجمالي</td>
                    <td className="px-3 py-2 text-xs font-semibold text-slate-700 tabular-nums text-center">
                      {totalDebit.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold text-slate-700 tabular-nums text-center">
                      {totalCredit.toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {!balanced && totalDebit > 0 && (
              <p className="text-red-500 text-xs mt-3">
                ⚠ الفرق: {Math.abs(totalDebit - totalCredit).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م — المدين يجب أن يساوي الدائن
              </p>
            )}
            {balanced && totalDebit > 0 && (
              <p className="text-green-600 text-xs mt-3">✓ القيد متوازن</p>
            )}
          </Section>
        </form>
      </EntityFormPage>
    </>
  );
}
