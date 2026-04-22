import { prisma } from './db';

export interface TenantSettings {
  currency: string;
  currencySymbol: string;
  taxRate: number;
  fiscalYearStartMonth: number; // 1-12
  language: 'ar' | 'en';
  dateFormat: string;
  onboardingCompleted: boolean;
}

export const DEFAULT_SETTINGS: TenantSettings = {
  currency: 'SAR',
  currencySymbol: 'ر.س',
  taxRate: 15,
  fiscalYearStartMonth: 1,
  language: 'ar',
  dateFormat: 'DD/MM/YYYY',
  onboardingCompleted: false,
};

export async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  return { ...DEFAULT_SETTINGS, ...((t?.settings as any) || {}) };
}

export async function updateTenantSettings(tenantId: string, patch: Partial<TenantSettings>) {
  const current = await getTenantSettings(tenantId);
  const merged = { ...current, ...patch };
  await prisma.tenant.update({ where: { id: tenantId }, data: { settings: merged as any } });
  return merged;
}

export async function isOnboardingComplete(tenantId: string): Promise<boolean> {
  const s = await getTenantSettings(tenantId);
  return !!s.onboardingCompleted;
}

export const ONBOARDING_EXEMPT_PATHS = [
  '/api/auth',
  '/api/onboarding',
  '/api/setup',
  '/api/init',
  '/api/health',
  '/api/tenants',
  '/api/sessions',
];

export function isOnboardingExempt(pathname: string): boolean {
  return ONBOARDING_EXEMPT_PATHS.some(p => pathname.startsWith(p));
}

export async function requireOnboarded(tenantId: string | null) {
  if (!tenantId) throw new Error('NO_TENANT');
  const ok = await isOnboardingComplete(tenantId);
  if (!ok) throw new Error('ONBOARDING_REQUIRED');
}
