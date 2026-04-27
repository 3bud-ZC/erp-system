#!/usr/bin/env node

/**
 * Railway / production startup wrapper.
 *
 * Behavior on every start:
 *   1. Verify DATABASE_URL is set (fail fast if not).
 *   2. Run `prisma migrate deploy` — forward-only, idempotent. Applies any
 *      pending migrations and is a no-op when the DB is already up to date.
 *      This is the standard Prisma+Railway pattern and prevents the failure
 *      mode where a freshly-deployed code expects columns that don't exist.
 *   3. Start the Next.js app (`next start`).
 *
 * Opt-in only:
 *   - `RAILWAY_RUN_INIT=true` — runs scripts/railway-init.js (demo seed).
 *
 * `prisma db push` is NEVER run — it's destructive on schema drift.
 */

const { execSync } = require('child_process');

console.log('🚀 Production startup');
console.log('═══════════════════════════════════════');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Refusing to start.');
  process.exit(1);
}

// Auto: forward-only migrations (idempotent — no-op if up to date).
console.log('⚙️  Running prisma migrate deploy ...');
try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: process.cwd() });
  console.log('✅ Migrations up to date.');
} catch (e) {
  console.error('❌ Migration failed. Refusing to start.');
  process.exit(1);
}

// One-off opt-in: demo data bootstrap.
if (process.env.RAILWAY_RUN_INIT === 'true') {
  console.log('⚙️  RAILWAY_RUN_INIT=true — running railway-init.js...');
  try {
    execSync('node scripts/railway-init.js', { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Init complete.');
  } catch {
    console.warn('⚠️  Init warnings — continuing.');
  }
}

const port = process.env.PORT || 3000;
console.log(`🚀 Starting Next.js on :${port}`);
execSync(`npx next start -p ${port}`, { stdio: 'inherit', cwd: process.cwd() });
