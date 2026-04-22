'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/card';
import Loader from '@/components/ui/Loader';
import ErrorState from '@/components/ui/ErrorState';

interface Form {
  companyName: string;
  companyNameAr: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  fiscalYearStartMonth: number;
  language: 'ar' | 'en';
  initializeCoA: boolean;
}

const DEFAULT: Form = {
  companyName: '',
  companyNameAr: '',
  email: '',
  phone: '',
  address: '',
  currency: 'SAR',
  currencySymbol: 'ر.س',
  taxRate: 15,
  fiscalYearStartMonth: 1,
  language: 'ar',
  initializeCoA: true,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/onboarding', { credentials: 'include' });
        const j = await res.json();
        if (j.success) {
          if (j.data.completed) return router.push('/dashboard');
          setForm(f => ({ ...f, ...(j.data.settings || {}) }));
        }
      } catch {}
      setLoading(false);
    })();
  }, [router]);

  const update = (k: keyof Form, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.message || 'فشل الإعداد');
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader /></div>;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">مرحباً بك في النظام</h1>
          <p className="text-sm text-gray-500 mt-1">لنقم بإعداد شركتك في 3 خطوات</p>
        </div>

        <Stepper current={step} />

        <Card className="mt-6">
          {error && <div className="mb-4"><ErrorState message={error} /></div>}

          {step === 1 && <StepCompany form={form} update={update} />}
          {step === 2 && <StepFinancial form={form} update={update} />}
          {step === 3 && <StepConfirm form={form} />}

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              className="px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-40"
            >السابق</button>
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && !form.companyName}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40"
              >التالي</button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40"
              >{submitting ? 'جاري الحفظ...' : 'إنهاء الإعداد'}</button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  const steps = ['بيانات الشركة', 'الإعداد المالي', 'التأكيد'];
  return (
    <div className="flex items-center justify-between">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={n} className="flex items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-green-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{done ? '✓' : n}</div>
            <span className={`mx-2 text-xs ${active ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{label}</span>
            {n < steps.length && <div className="flex-1 h-px bg-gray-200" />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

const input = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';

function StepCompany({ form, update }: { form: Form; update: (k: keyof Form, v: any) => void }) {
  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-4">بيانات الشركة</h2>
      <Field label="اسم الشركة (عربي) *"><input className={input} value={form.companyNameAr} onChange={e => update('companyNameAr', e.target.value)} /></Field>
      <Field label="اسم الشركة (إنجليزي) *"><input className={input} value={form.companyName} onChange={e => update('companyName', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="البريد الإلكتروني"><input type="email" className={input} value={form.email} onChange={e => update('email', e.target.value)} /></Field>
        <Field label="الهاتف"><input className={input} value={form.phone} onChange={e => update('phone', e.target.value)} /></Field>
      </div>
      <Field label="العنوان"><textarea className={input} rows={2} value={form.address} onChange={e => update('address', e.target.value)} /></Field>
    </div>
  );
}

function StepFinancial({ form, update }: { form: Form; update: (k: keyof Form, v: any) => void }) {
  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-4">الإعداد المالي</h2>
      <div className="grid grid-cols-2 gap-4">
        <Field label="العملة"><input className={input} value={form.currency} onChange={e => update('currency', e.target.value)} /></Field>
        <Field label="رمز العملة"><input className={input} value={form.currencySymbol} onChange={e => update('currencySymbol', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="نسبة الضريبة %"><input type="number" className={input} value={form.taxRate} onChange={e => update('taxRate', Number(e.target.value))} /></Field>
        <Field label="شهر بداية السنة المالية">
          <select className={input} value={form.fiscalYearStartMonth} onChange={e => update('fiscalYearStartMonth', Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 mt-3">
        <input type="checkbox" checked={form.initializeCoA} onChange={e => update('initializeCoA', e.target.checked)} />
        <span className="text-sm text-gray-700">إنشاء شجرة الحسابات الافتراضية</span>
      </label>
    </div>
  );
}

function StepConfirm({ form }: { form: Form }) {
  const Row = ({ k, v }: { k: string; v: any }) => (
    <div className="flex justify-between py-2 border-b border-gray-100 text-sm">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-900 font-medium">{v || '—'}</span>
    </div>
  );
  return (
    <div>
      <h2 className="font-semibold text-gray-800 mb-4">تأكيد البيانات</h2>
      <Row k="الشركة (عربي)" v={form.companyNameAr} />
      <Row k="الشركة (إنجليزي)" v={form.companyName} />
      <Row k="البريد" v={form.email} />
      <Row k="الهاتف" v={form.phone} />
      <Row k="العملة" v={`${form.currency} (${form.currencySymbol})`} />
      <Row k="نسبة الضريبة" v={`${form.taxRate}%`} />
      <Row k="بداية السنة المالية" v={`الشهر ${form.fiscalYearStartMonth}`} />
      <Row k="شجرة الحسابات" v={form.initializeCoA ? 'سيتم إنشاؤها' : 'لن يتم إنشاؤها'} />
    </div>
  );
}
