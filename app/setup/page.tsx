'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState('جاري إعداد النظام...');
  const [error, setError] = useState('');

  useEffect(() => {
    const setup = async () => {
      try {
        // Run setup
        setStatus('جاري إنشاء المستخدم التجريبي والبيانات...');
        const response = await fetch('/api/setup');
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'فشل في الإعداد');
        }

        setStatus('تم الإعداد بنجاح! جاري تسجيل الدخول...');

        // Auto-login with demo user
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'demo@erp-system.com',
            password: 'demo12345'
          }),
        });

        if (!loginResponse.ok) {
          throw new Error('فشل في تسجيل الدخول بعد الإعداد');
        }

        const loginData = await loginResponse.json();
        
        if (loginData.token) {
          localStorage.setItem('token', loginData.token);
          setStatus('تم تسجيل الدخول! جاري التوجيه...');
          setTimeout(() => router.replace('/dashboard'), 1000);
        } else {
          throw new Error('لم يتم استلام رمز التوثيق');
        }

      } catch (err: any) {
        const errorMessage = err?.message || err?.toString() || 'Unknown error';
        console.error('Setup error:', errorMessage);
        setError(errorMessage);
        setStatus('حدث خطأ');
      }
    };

    setup();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 mb-2 font-medium">{status}</p>
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              إعادة المحاولة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
