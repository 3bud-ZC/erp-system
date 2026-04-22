'use client';

import { ReactNode } from 'react';
import { useHasRole, useHasPermission } from '@/components/providers/AppProviders';

interface Props {
  role?: string | string[];
  permission?: string | string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export default function RequireRole({ role, permission, fallback = null, children }: Props) {
  const hasRole = useHasRole(role || []);
  const hasPerm = useHasPermission(permission || []);
  const allowed = (role ? hasRole : true) && (permission ? hasPerm : true);
  return <>{allowed ? children : fallback}</>;
}
