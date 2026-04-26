/**
 * Test infrastructure: ensure the e2e admin can log in AND has a usable tenant.
 *
 * Two stale-data problems this script recovers from:
 *
 * 1) Password drift — prisma/seed-auth.ts uses `upsert({ update: {} })` which
 *    does NOT re-hash the password if the user already exists. After env changes
 *    or across machines the bcrypt hash diverges from the documented default
 *    ('admin'), causing E2E login to 401. We force-reset the password.
 *
 * 2) Missing tenant — without at least one UserTenantRole, the login route
 *    returns hasTenant=false and redirects to /onboarding. Dashboard pages
 *    (customers, products, journal-entries) then fail to load data because
 *    they require a tenant context. We ensure the admin has at least one
 *    tenant + admin role assignment.
 *
 * Idempotent and safe to re-run. Only mutates the seeded admin + a single
 * E2E tenant; no other production data is touched.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const EMAIL = process.env.E2E_EMAIL ?? 'admin@erp.com';
const PASSWORD = process.env.E2E_PASSWORD ?? 'admin';
const TENANT_CODE = process.env.E2E_TENANT_CODE ?? 'E2E_DEFAULT';

// 🛡️  PRODUCTION SAFETY GUARD
// This script mutates the admin user's password and prunes UserTenantRole
// rows. Refuse to run unless the operator explicitly opts in. CI sets
// E2E_ALLOW_AUTH_RESET=1; production environments must never set it.
function assertResetAllowed(): void {
  if (process.env.E2E_ALLOW_AUTH_RESET === '1') return;
  if (process.env.NODE_ENV === 'development') return;
  if (process.env.ALLOW_SEED === 'true') return;
  throw new Error(
    `❌ Admin auth-reset is disabled. ` +
      `This script writes to the admin user and prunes tenant assignments. ` +
      `Set E2E_ALLOW_AUTH_RESET=1 (CI) or NODE_ENV=development to allow.`
  );
}

async function main() {
  assertResetAllowed();

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (!user) {
      console.log(`[reset-admin-password] no user '${EMAIL}' yet; run seed-auth first`);
      return;
    }

    // 1. Reset password
    const hash = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.update({
      where: { email: EMAIL },
      data: { password: hash, isActive: true },
    });
    console.log(`[reset-admin-password] reset password for ${EMAIL}`);

    // 2. Ensure tenant exists
    const tenant = await prisma.tenant.upsert({
      where: { tenantCode: TENANT_CODE },
      update: {},
      create: {
        tenantCode: TENANT_CODE,
        name: 'E2E Default Tenant',
        nameAr: 'مستأجر اختبار افتراضي',
        status: 'active',
        subscriptionPlan: 'enterprise',
      },
    });

    // 3. Find admin role (created by seed-auth.ts)
    const adminRole = await prisma.role.findUnique({ where: { code: 'admin' } });
    if (!adminRole) {
      console.log(`[reset-admin-password] no role 'admin' yet; run seed-auth first`);
      return;
    }

    // 4. Ensure UserTenantRole — gives admin access to the E2E tenant.
    //    First, delete any OTHER tenant assignments. lib/auth.ts uses
    //    `prisma.userTenantRole.findFirst({ where: { userId } })` without
    //    an explicit orderBy, so multiple assignments cause non-deterministic
    //    tenant selection at login. Stale assignments from prior full-seed
    //    runs would otherwise route us into a tenant that lacks the chart of
    //    accounts, making the journal-entries spec fail with "Account
    //    1001 not found".
    await prisma.userTenantRole.deleteMany({
      where: { userId: user.id, NOT: { tenantId: tenant.id } },
    });
    await prisma.userTenantRole.upsert({
      where: {
        userId_tenantId_roleId: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        tenantId: tenant.id,
        roleId: adminRole.id,
      },
    });

    // 5. Ensure chart of accounts for the E2E tenant.
    //
    //    Two specs require accounts:
    //    a) journal-entries spec posts a balanced entry against 1001 (cash) /
    //       4001 (revenue). If missing, the API rejects with
    //       "Account with code XXXX not found".
    //    b) sales-invoices spec creates an invoice; the atomic transaction
    //       service (lib/erp-execution-engine/services/atomic-transaction-service.ts)
    //       creates a JournalEntry with lines referencing accountCodes 1020
    //       (AR), 4010 (Sales Revenue), and 2030 (Sales Tax Payable). The
    //       JournalEntryLine table has FK (tenantId, accountCode) → Account,
    //       so missing codes cause a Prisma FK violation that aborts the
    //       whole atomic transaction (invoice creation rolled back).
    //
    //    Seeding all the codes used across both flows below is sufficient.
    const requiredAccounts = [
      // Journal-entries spec
      { code: '1001', nameAr: 'النقدية', type: 'asset', subType: 'current_asset' },
      { code: '4001', nameAr: 'إيرادات المبيعات', type: 'income', subType: 'sales' },
      // Sales-invoices atomic transaction
      { code: '1020', nameAr: 'المستحقات من العملاء', type: 'asset', subType: 'receivable' },
      { code: '1030', nameAr: 'المخزون', type: 'asset', subType: 'inventory' },
      { code: '2030', nameAr: 'ضريبة المبيعات المستحقة', type: 'liability', subType: 'tax' },
      { code: '4010', nameAr: 'إيرادات المبيعات', type: 'income', subType: 'sales' },
      { code: '5010', nameAr: 'تكلفة البضاعة المباعة', type: 'expense', subType: 'cogs' },
    ];
    for (const acct of requiredAccounts) {
      await prisma.account.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code: acct.code } },
        update: {},
        create: {
          tenantId: tenant.id,
          code: acct.code,
          nameAr: acct.nameAr,
          type: acct.type,
          subType: acct.subType,
        },
      });
    }
    console.log(`[reset-admin-password] ensured tenant '${TENANT_CODE}' + admin role + base accounts`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[reset-admin-password] failed:', err);
  process.exit(1);
});
