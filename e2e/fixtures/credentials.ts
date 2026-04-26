/**
 * Central source of truth for E2E test credentials.
 * Override via env: E2E_EMAIL, E2E_PASSWORD.
 *
 * Defaults match prisma/seed-auth.ts (admin@erp.com / admin).
 *
 * Use `||` (truthy fallback) NOT `??` (nullish coalescing) — some shells (notably
 * PowerShell when piping `$env:VAR=''`) propagate empty strings instead of unset
 * vars, and `??` would let an empty string through, breaking the login.
 */
export const TEST_EMAIL = process.env.E2E_EMAIL || 'admin@erp.com';
export const TEST_PASSWORD = process.env.E2E_PASSWORD || 'admin';

/** Unique suffix for create-flows so reruns don't collide on unique codes. */
export const runId = () => Date.now().toString().slice(-9);
