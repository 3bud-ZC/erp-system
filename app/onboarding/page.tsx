'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [companyNameAr, setCompanyNameAr] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [taxRate, setTaxRate] = useState(15);

  const canProceed = companyName.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/onboarding/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          companyName: companyName.trim(),
          companyNameAr: companyNameAr.trim() || companyName.trim(),
          currency,
          taxRate: Number(taxRate),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل إعداد الشركة');
      }

      // Cookie was refreshed server-side with tenantId — go straight to dashboard
      useAuthStore.setState({ isAuthenticated: true });
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-blue-600 px-8 py-6 text-white">
          <h1 className="text-xl font-bold">مرحباً بك في نظام ERP</h1>
          <p className="text-blue-100 text-sm mt-1">أكمل إعداد شركتك للبدء</p>
        </div>

        {/* Steps indicator */}
        <div className="flex border-b border-gray-100">
          {['بيانات الشركة', 'الإعدادات المالية', 'تأكيد'].map((label, i) => {
            const n = i + 1;
            return (
              <div key={n} className={`flex-1 py-3 text-center text-xs font-medium ${step === n ? 'text-blue-600 border-b-2 border-blue-600' : step > n ? 'text-green-600' : 'text-gray-400'}`}>
                {step > n ? '✓ ' : ''}{label}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {/* Step 1: Company Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اسم الشركة (بالإنجليزية) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="My Company"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اسم الشركة (بالعربية)
                </label>
                <input
                  type="text"
                  value={companyNameAr}
                  onChange={e => setCompanyNameAr(e.target.value)}
                  placeholder="شركتي"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Step 2: Financial settings */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العملة</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="AED">درهم إماراتي (AED)</option>
                  <option value="KWD">دينار كويتي (KWD)</option>
                  <option value="BHD">دينار بحريني (BHD)</option>
                  <option value="QAR">ريال قطري (QAR)</option>
                  <option value="OMR">ريال عماني (OMR)</option>
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نسبة ضريبة القيمة المضافة (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxRate}
                  onChange={e => setTaxRate(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 mb-4">مراجعة البيانات</h3>
              {[
                ['اسم الشركة (EN)', companyName],
                ['اسم الشركة (AR)', companyNameAr || companyName],
                ['العملة', currency],
                ['نسبة الضريبة', `${taxRate}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5 border-b border-gray-100 text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-900">{v}</span>
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-4">
                سيتم إنشاء حساب الشركة ومنحك صلاحيات المدير الكامل
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              السابق
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'جاري الإعداد...' : 'إنهاء الإعداد والدخول'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
