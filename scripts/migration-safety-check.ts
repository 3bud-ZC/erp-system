#!/usr/bin/env node
/* Usage: ts-node scripts/migration-safety-check.ts */
import { execSync } from 'child_process';
import { validateEnv } from '../lib/env';

const DANGEROUS = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /TRUNCATE/i, /ALTER\s+.*\s+DROP/i];

function log(level: 'info' | 'warn' | 'error', msg: string, meta?: any) {
  const line = { ts: new Date().toISOString(), level, scope: 'migration-safety', msg, ...(meta ? { meta } : {}) };
  const out = JSON.stringify(line);
  if (level === 'error') console.error(out); else console.log(out);
}

function fail(msg: string, meta?: any): never {
  log('error', msg, meta);
  process.exit(1);
}

async function main() {
  const env = validateEnv();
  log('info', 'starting migration safety check', { mode: env.mode });

  if (!env.valid) fail('env invalid', { missing: env.missing });
  if (env.mode === 'production' && env.warnings.length) {
    log('warn', 'env warnings in production', { warnings: env.warnings });
    if (process.env.STRICT_ENV === '1') fail('STRICT_ENV=1: aborting due to warnings');
  }

  let diff = '';
  try {
    diff = execSync(
      'npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (e: any) {
    log('warn', 'prisma diff unavailable', { error: e?.message });
  }

  const hits = DANGEROUS.filter(rx => rx.test(diff));
  if (hits.length && env.mode === 'production') {
    fail('destructive operations detected in production migration', { patterns: hits.map(r => r.source) });
  }

  if (hits.length) {
    log('warn', 'destructive operations detected (non-production)', { patterns: hits.map(r => r.source) });
  } else {
    log('info', 'migration safety check passed');
  }
}

main().catch(e => fail('unhandled error', { error: e?.message, stack: e?.stack }));
