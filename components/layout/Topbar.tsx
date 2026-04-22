'use client';

import { Bell, Search, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth';
import { useTenantStore } from '@/lib/store/tenant';

export function Topbar() {
  const { user, logout } = useAuthStore();
  const { currentTenant } = useTenantStore();

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      {/* Left - Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User Menu */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="text-right">
            <div className="text-sm font-medium text-slate-900">
              {user?.name || 'User'}
            </div>
            <div className="text-xs text-slate-500">
              {currentTenant?.name || 'No Tenant'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
            {user?.name?.[0] || 'U'}
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
