/**
 * 🛡️  Environment-isolation guard for E2E tooling
 * ----------------------------------------------------------------------------
 * Refuses to run if `DATABASE_URL` points at a remote host that looks like a
 * managed production database. The intent is to make it physically impossible
 * for `npm run e2e` (or its setup helpers) to mutate the production Railway
 * database, even if an engineer accidentally points their `.env` at it.
 *
 * Allow-list (no override needed):
 *   - localhost / 127.0.0.1 / ::1
 *   - any *.local / *.localhost host
 *   - DATABASE_URL containing `_test`, `_e2e`, `_ci` in the dbname
 *
 * Explicit override:
 *   - Set `E2E_ALLOW_PRODUCTION_DB=1` to bypass this guard. Only use this when
 *     you have already provisioned a sacrificial test DB at a remote host.
 *
 * Usage:
 *   import { assertIsolatedDatabase } from './assert-isolated-db';
 *   assertIsolatedDatabase();
 *
 * The function never opens a DB connection; it only inspects the URL string.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const TEST_DBNAME_HINTS = ['_test', '_e2e', '_ci', '-test', '-e2e', '-ci'];

export interface IsolationCheckResult {
  ok: boolean;
  host: string;
  database: string;
  reason?: string;
}

/**
 * Inspect the URL without throwing. Useful for tests / dry-runs.
 */
export function inspectDatabaseUrl(url: string | undefined): IsolationCheckResult {
  if (!url) {
    return { ok: false, host: '(unset)', database: '(unset)', reason: 'DATABASE_URL is not set' };
  }

  let parsed: URL;
  try {
    // Prisma URLs use postgresql:// scheme; URL parser handles it.
    parsed = new URL(url);
  } catch {
    return { ok: false, host: '(unparseable)', database: '(unparseable)', reason: 'DATABASE_URL is not a valid URL' };
  }

  const host = parsed.hostname.toLowerCase();
  const database = parsed.pathname.replace(/^\//, '').toLowerCase();

  const isLocal = LOCAL_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.localhost');
  const looksLikeTestDb = TEST_DBNAME_HINTS.some((hint) => database.includes(hint));

  if (isLocal) {
    return { ok: true, host, database };
  }
  if (looksLikeTestDb) {
    return { ok: true, host, database };
  }

  return {
    ok: false,
    host,
    database,
    reason:
      `DATABASE_URL host '${host}' (db='${database}') is not localhost and the database name ` +
      `does not contain a test marker (_test/_e2e/_ci). Refusing to run E2E tooling against ` +
      `what looks like a production-managed database.`,
  };
}

/**
 * Throw unless the database is local / clearly test-marked, OR the operator
 * has explicitly opted in via E2E_ALLOW_PRODUCTION_DB=1.
 *
 * Should be called BEFORE any Prisma client is instantiated.
 */
export function assertIsolatedDatabase(): void {
  if (process.env.E2E_ALLOW_PRODUCTION_DB === '1') {
    // Loud, explicit acknowledgement. Anyone reading the logs knows what's
    // happening. Never default-on.
    // eslint-disable-next-line no-console
    console.warn(
      '⚠️  E2E_ALLOW_PRODUCTION_DB=1 — production-DB safety check bypassed by operator.'
    );
    return;
  }

  const result = inspectDatabaseUrl(process.env.DATABASE_URL);
  if (result.ok) return;

  throw new Error(
    `❌ E2E refused to run.\n` +
      `   ${result.reason}\n` +
      `   Host:    ${result.host}\n` +
      `   DB name: ${result.database}\n\n` +
      `   To proceed, point DATABASE_URL at one of:\n` +
      `     - localhost / 127.0.0.1 (recommended for local E2E)\n` +
      `     - a remote DB whose name contains '_test' / '_e2e' / '_ci'\n` +
      `   ...or set E2E_ALLOW_PRODUCTION_DB=1 to bypass (NOT recommended).\n`
  );
}

// CLI entry point — invoking this file directly performs the check and exits.
if (require.main === module) {
  try {
    assertIsolatedDatabase();
    // eslint-disable-next-line no-console
    console.log('✓ DATABASE_URL is isolated (safe for E2E).');
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err.message);
    process.exit(1);
  }
}
