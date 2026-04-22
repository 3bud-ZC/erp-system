const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];
const PROD_REQUIRED = ['NEXTAUTH_SECRET'];

export interface EnvReport {
  valid: boolean;
  mode: 'development' | 'production' | 'test';
  missing: string[];
  warnings: string[];
}

export function validateEnv(): EnvReport {
  const mode = (process.env.NODE_ENV || 'development') as EnvReport['mode'];
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED) if (!process.env[key]) missing.push(key);
  if (mode === 'production') {
    for (const key of PROD_REQUIRED) if (!process.env[key]) missing.push(key);
    if ((process.env.JWT_SECRET || '').length < 32) warnings.push('JWT_SECRET is shorter than 32 chars');
    if (process.env.JWT_SECRET?.includes('change')) warnings.push('JWT_SECRET appears to be a default value');
    if (process.env.DATABASE_URL?.startsWith('file:')) warnings.push('SQLite DB in production is not recommended');
  }

  return { valid: missing.length === 0, mode, missing, warnings };
}

export function assertEnv() {
  const r = validateEnv();
  if (!r.valid) throw new Error(`Missing required env vars: ${r.missing.join(', ')}`);
  if (r.mode === 'production' && r.warnings.length) {
    if (process.env.STRICT_ENV === '1') {
      throw new Error(`STRICT_ENV: production warnings: ${r.warnings.join('; ')}`);
    }
    console.warn('[env warnings]', r.warnings.join('; '));
  }
  return r;
}
