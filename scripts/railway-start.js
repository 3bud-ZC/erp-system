#!/usr/bin/env node

/**
 * Railway / production startup wrapper — PRODUCTION-SAFE BY DEFAULT.
 *
 * Behavior:
 *   1. Verify DATABASE_URL is set (fail fast if not).
 *   2. Start the Next.js app (`next start`).
 *
 * Behavior NOT included by default:
 *   - `prisma db push` — destructive on schema drift; operator-managed.
 *   - `prisma migrate deploy` — operator-managed (one-off, manual).
 *   - `railway-init.js` — creates demo users; operator-managed (one-off).
 *
 * To run schema migrations once after first deploy, set
 * `RAILWAY_RUN_MIGRATE=true` for that single deployment, then unset it.
 * Likewise `RAILWAY_RUN_INIT=true` for the demo bootstrap.
 *
 * In normal steady-state operation, every restart performs ZERO database
 * mutations — only the application runs.
 */

const { execSync } = require('child_process');

console.log('🚀 Production startup — safe-by-default');
console.log('═══════════════════════════════════════');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Refusing to start.');
  process.exit(1);
}

// One-off opt-in: schema migrations.
if (process.env.RAILWAY_RUN_MIGRATE === 'true') {
  console.log('⚙️  RAILWAY_RUN_MIGRATE=true — running prisma migrate deploy...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Migrations applied.');
  } catch (e) {
    console.error('❌ Migration failed. Refusing to start.');
    process.exit(1);
  }
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
