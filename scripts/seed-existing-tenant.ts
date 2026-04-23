import { PrismaClient } from '@prisma/client';
import { seedDemoData } from '../lib/seed-demo-data';

const prisma = new PrismaClient();

async function main() {
  const utr = await prisma.userTenantRole.findFirst({
    where: { user: { email: 'admin@erp.com' } },
    select: { tenantId: true },
  });

  if (!utr) { console.log('No tenant found'); return; }

  const tenantId = utr.tenantId;
  const existingCustomers = await prisma.customer.count({ where: { tenantId } });

  if (existingCustomers > 0) {
    console.log(`Already seeded: ${existingCustomers} customers in tenant ${tenantId}`);
    return;
  }

  console.log(`Seeding demo data for tenant ${tenantId}...`);
  const result = await seedDemoData(tenantId);
  console.log('Seed complete:', JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
