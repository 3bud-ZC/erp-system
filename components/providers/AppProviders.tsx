'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

// ---------- Theme ----------
type Theme = 'light' | 'dark';
interface ThemeCtx { theme: Theme; toggle: () => void; set: (t: Theme) => void }
const ThemeContext = createContext<ThemeCtx>({ theme: 'light', toggle: () => {}, set: () => {} });

// ---------- User / Tenant ----------
interface CurrentUser { id: string; email: string; name: string; roles: string[]; permissions: string[] }
interface TenantBranding { logoUrl?: string; brandColor?: string; companyName?: string; companyNameAr?: string }
interface AppCtx { user: CurrentUser | null; tenant: TenantBranding | null; loading: boolean; refresh: () => Promise<void> }
const AppContext = createContext<AppCtx>({ user: null, tenant: null, loading: true, refresh: async () => {} });

export function AppProviders({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [tenant, setTenant] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);

  // Theme hydration
  useEffect(() => {
    try {
      const saved = (localStorage.getItem('theme') as Theme) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      setTheme(saved);
    } catch {}
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  // Apply brand color as CSS var
  useEffect(() => {
    if (tenant?.brandColor) document.documentElement.style.setProperty('--brand', tenant.brandColor);
  }, [tenant?.brandColor]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, onRes] = await Promise.all([
        fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' }).catch(() => null),
        fetch('/api/onboarding', { credentials: 'include', cache: 'no-store' }).catch(() => null),
      ]);
      if (meRes?.ok) {
        const j = await meRes.json();
        setUser(j.data?.user || j.data || null);
      }
      if (onRes?.ok) {
        const j = await onRes.json();
        const s = j.data?.settings || {};
        setTenant({
          logoUrl: s.logoUrl,
          brandColor: s.brandColor || '#2563eb',
          companyName: s.companyName,
          companyNameAr: s.companyNameAr,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const themeCtx: ThemeCtx = {
    theme,
    toggle: () => setTheme(t => (t === 'light' ? 'dark' : 'light')),
    set: setTheme,
  };

  return (
    <ThemeContext.Provider value={themeCtx}>
      <AppContext.Provider value={{ user, tenant, loading, refresh }}>
        {children}
      </AppContext.Provider>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useApp = () => useContext(AppContext);

export function useHasRole(role: string | string[]) {
  const { user } = useApp();
  const roles = Array.isArray(role) ? role : [role];
  return !!user && roles.some(r => user.roles.includes(r));
}
export function useHasPermission(perm: string | string[]) {
  const { user } = useApp();
  const perms = Array.isArray(perm) ? perm : [perm];
  return !!user && perms.some(p => user.permissions.includes(p));
}
