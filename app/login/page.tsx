'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Auto-login with demo user
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const autoLogin = async () => {
      try {
        // Try to login with demo user
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: '',
            password: '',
          }),
        });

        if (!response.ok) {
          // If demo user doesn't exist, try admin user
          const adminResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: '',
              password: '',
            }),
          });

          if (!adminResponse.ok) {
            throw new Error('فشل في تسجيل الدخول');
          }

          const adminData = await adminResponse.json();
          if (adminData.token) {
            localStorage.setItem('token', adminData.token);
            router.replace('/dashboard');
            return;
          }
        }

        const data = await response.json();
        
        if (data.token) {
          // Store token in localStorage
          localStorage.setItem('token', data.token);
          // Redirect to dashboard
          router.replace('/dashboard');
        } else {
          throw new Error('لم يتم استلام رمز التوثيق');
        }
      } catch (err: any) {
        console.error('Auto-login error:', err);
        setError('المستخدم غير موجود. جاري إعداد النظام...');
        // Redirect to setup page to create demo user
        setTimeout(() => {
          router.replace('/setup');
        }, 2000);
      }
    };

    autoLogin();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center bg-white p-8 rounded-xl shadow-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 mb-2">جاري تسجيل الدخول...</p>
        {error && (
          <p className="text-orange-500 text-sm mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}
