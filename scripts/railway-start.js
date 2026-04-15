#!/usr/bin/env node

/**
 * Railway Startup Script
 * Runs database setup before starting the app
 */

const { execSync } = require('child_process');

console.log('🚀 Railway Startup Script');
console.log('==========================\n');

try {
  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found!');
    console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('POSTGRES')));
    process.exit(1);
  }

  console.log('✅ DATABASE_URL found');
  console.log('📦 Running prisma db push...\n');

  // Push schema
  try {
    execSync('npx prisma db push --accept-data-loss', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Schema pushed successfully\n');
  } catch (e) {
    console.log('⚠️ Schema push may have warnings, continuing...\n');
  }

  // Skip initialization if SKIP_INIT is set (for faster restarts)
  if (process.env.SKIP_INIT !== 'true') {
    console.log('🌱 Running database initialization...\n');
    try {
      execSync('node scripts/railway-init.js', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Database initialized\n');
    } catch (e) {
      console.log('⚠️ Init may have warnings, continuing...\n');
    }
  } else {
    console.log('⏭️ Skipping initialization (SKIP_INIT=true)\n');
  }

  // Start the app
  console.log('🚀 Starting Next.js app...\n');
  const port = process.env.PORT || 3000;
  execSync(`npx next start -p ${port}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

} catch (error) {
  console.error('❌ Startup failed:', error.message);
  process.exit(1);
}
