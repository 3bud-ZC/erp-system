'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Login disabled - direct access to dashboard
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard immediately (no auth required)
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">جاري تحويلك للداشبورد...</p>
      </div>
    </div>
  );
}
