#!/usr/bin/env node
/* Usage: ts-node scripts/backup.ts  (PostgreSQL; requires pg_dump on PATH) */
import { execSync } from 'child_process';
import { mkdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

function log(level: 'info' | 'warn' | 'error', msg: string, meta?: any) {
  const line = { ts: new Date().toISOString(), level, scope: 'backup', msg, ...(meta ? { meta } : {}) };
  const out = JSON.stringify(line);
  if (level === 'error') console.error(out); else console.log(out);
}

function fail(msg: string, meta?: any): never {
  log('error', msg, meta);
  const isProd = process.env.NODE_ENV === 'production';
  process.exit(isProd ? 1 : 2);
}

function main() {
  const url = process.env.DATABASE_URL;
  if (!url) fail('DATABASE_URL not set');
  if (!url!.startsWith('postgres')) fail('only postgresql backups supported', { urlPrefix: url!.slice(0, 10) });

  const dir = process.env.BACKUP_DIR || './backups';
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  } catch (e: any) {
    fail('cannot create backup directory', { dir, error: e.message });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = join(dir, `backup-${ts}.sql`);

  try {
    log('info', 'starting pg_dump', { outFile });
    execSync(`pg_dump --no-owner --format=plain "${url}" > "${outFile}"`, { stdio: ['ignore', 'inherit', 'inherit'], shell: '/bin/bash' as any });
    const size = statSync(outFile).size;
    if (size === 0) fail('backup file is empty', { outFile });
    log('info', 'backup completed', { outFile, sizeBytes: size });
  } catch (e: any) {
    fail('pg_dump failed', { error: e.message });
  }
}

try { main(); } catch (e: any) { fail('unhandled error', { error: e?.message, stack: e?.stack }); }
