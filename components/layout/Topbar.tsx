'use client';

import { Bell, Search, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { useRouter } from 'next/navigation';

export function Topbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6" dir="rtl">
      {/* Right - Search (RTL: right side is the start) */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث..."
            className="w-full pr-10 pl-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
          />
        </div>
      </div>

      {/* Left - Actions (RTL: left side is the end) */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button
          className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="الإشعارات"
        >
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-0 left-0 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User Info */}
        <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'م'}
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-slate-900 leading-tight">
              {user?.name || 'مدير النظام'}
            </div>
            <div className="text-xs text-slate-400 leading-tight">
              {user?.email || ''}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors text-slate-500"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
