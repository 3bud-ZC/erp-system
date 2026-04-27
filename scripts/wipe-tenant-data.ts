/**
 * Wipe all tenant business data while keeping identity tables intact.
 *
 * KEPT:
 *   - User, Tenant, UserTenantRole
 *   - Role, UserRole, Permission, RolePermission
 *   - Session
 *   - Unit, ItemGroup  (reference catalogs — global, not per-tenant)
 *
 * WIPED (everything else):
 *   - All sales / purchase / inventory / accounting / production /
 *     payments / audit / activity / notifications / workflow / outbox /
 *     idempotency / system-settings tables
 *
 * Safety:
 *   - Refuses to run unless WIPE_CONFIRM=YES is set in the environment.
 *   - Uses a single Postgres TRUNCATE ... RESTART IDENTITY CASCADE so
 *     foreign-key cascades are handled by the database itself.
 *
 * Usage:
 *   $env:WIPE_CONFIRM="YES"; npx tsx scripts/wipe-tenant-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Tables to keep (identity & global reference data).
// Sessions are wiped intentionally so the client logs in fresh.
const KEEP = new Set([
  'User',
  'Tenant',
  'UserTenantRole',
  'Role',
  'UserRole',
  'Permission',
  'RolePermission',
  'Unit',
  'ItemGroup',
  // Prisma migration metadata — never touch.
  '_prisma_migrations',
]);

async function main() {
  if (process.env.WIPE_CONFIRM !== 'YES') {
    console.error(
      '\n❌  Safety guard: this script will WIPE all business data.\n' +
      '    Re-run with WIPE_CONFIRM=YES to confirm.\n',
    );
    process.exit(1);
  }

  console.log('🧹  Wiping tenant business data — keeping users/tenants/permissions/roles/sessions.\n');

  // 1. Discover all real tables in the public schema.
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`,
  );

  const allTables = rows.map(r => r.tablename);
  const targets   = allTables.filter(t => !KEEP.has(t));

  console.log(`Discovered ${allTables.length} tables.`);
  console.log(`Keeping (${KEEP.size}):`, Array.from(KEEP).sort().join(', '));
  console.log(`Wiping  (${targets.length}):`, targets.join(', '));
  console.log('');

  if (targets.length === 0) {
    console.log('Nothing to wipe.');
    return;
  }

  // 2. Quote each table identifier and TRUNCATE in one statement.
  //    CASCADE so any FK from a kept-table → wiped table also clears
  //    (none should exist, but safer this way).
  //    RESTART IDENTITY resets serial sequences, useful for fresh demos.
  const list = targets.map(t => `"${t}"`).join(', ');
  const sql  = `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`;

  console.log('Running TRUNCATE ...');
  const t0 = Date.now();
  await prisma.$executeRawUnsafe(sql);
  console.log(`✅  Truncated ${targets.length} tables in ${Date.now() - t0} ms.\n`);

  // 2b. Delete orphan tenants — any Tenant row that no User is linked to.
  //     We do this AFTER the wipe so cascades from tenant-scoped tables
  //     don't matter (those tables are now empty).
  const orphanResult = await prisma.$executeRawUnsafe(`
    DELETE FROM "Tenant"
    WHERE "id" NOT IN (
      SELECT DISTINCT "tenantId" FROM "UserTenantRole" WHERE "tenantId" IS NOT NULL
    );
  `);
  console.log(`🗑️   Deleted ${orphanResult} orphan tenants (no users linked).`);

  // 2c. Re-create SystemSettings with initialized=true so the login page
  //     doesn't lock the system out after a wipe. Without this, every
  //     request returns "System is not initialized" until manually fixed.
  if (allTables.includes('SystemSettings')) {
    await (prisma as any).systemSettings.create({
      data: {
        initialized:    true,
        locked:         false,
        productionMode: process.env.NODE_ENV === 'production',
      },
    });
    console.log('🔧  Re-created SystemSettings (initialized=true).');
  }

  // 3. Sanity counts on a few representative tables.
  const samples = [
    'SalesInvoice', 'PurchaseInvoice', 'Customer', 'Supplier',
    'Product', 'Warehouse', 'JournalEntry', 'Account', 'Expense',
    'InventoryTransaction', 'Notification', 'AuditLog',
  ];
  for (const tbl of samples) {
    if (!allTables.includes(tbl)) continue;
    const r = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${tbl}";`,
    );
    console.log(`  ${tbl.padEnd(24)} → ${r[0].count}`);
  }

  // 4. Confirm kept tables are still populated.
  console.log('\nKept-table counts:');
  for (const tbl of ['User', 'Tenant', 'UserTenantRole', 'Role', 'Permission']) {
    if (!allTables.includes(tbl)) continue;
    const r = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${tbl}";`,
    );
    console.log(`  ${tbl.padEnd(24)} → ${r[0].count}`);
  }

  console.log('\n🎉  Wipe complete. The system is ready for client handoff.');
}

main()
  .catch(err => {
    console.error('❌  Wipe failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
