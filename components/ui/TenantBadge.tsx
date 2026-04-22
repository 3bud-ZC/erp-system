'use client';

import { useApp } from '@/components/providers/AppProviders';
import { Building2 } from 'lucide-react';

export default function TenantBadge() {
  const { tenant, user, loading } = useApp();
  if (loading) return <div className="h-8 w-40 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />;
  const name = tenant?.companyNameAr || tenant?.companyName || 'غير محدد';
  return (
    <div className="flex items-center gap-3 min-w-0">
      {tenant?.logoUrl ? (
        <img src={tenant.logoUrl} alt="logo" className="w-8 h-8 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
      ) : (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[color:var(--brand,#2563eb)] text-white">
          <Building2 size={16} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">{name}</div>
        {user && <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user.email}</div>}
      </div>
    </div>
  );
}
