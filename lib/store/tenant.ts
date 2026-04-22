/**
 * Tenant Store - Zustand
 * Multi-tenant context management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Tenant {
  id: string;
  name: string;
  settings: Record<string, any>;
}

interface TenantState {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  setTenant: (tenant: Tenant) => void;
  setTenants: (tenants: Tenant[]) => void;
  switchTenant: (tenantId: string) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      currentTenant: null,
      tenants: [],
      setTenant: (tenant) => set({ currentTenant: tenant }),
      setTenants: (tenants) => set({ tenants }),
      switchTenant: (tenantId) => {
        const tenant = get().tenants.find((t) => t.id === tenantId);
        if (tenant) {
          set({ currentTenant: tenant });
          localStorage.setItem('tenant_id', tenantId);
        }
      },
    }),
    {
      name: 'tenant-storage',
    }
  )
);
