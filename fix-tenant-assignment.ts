import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing tenant assignment for demo user...');

  try {
    // Get demo user
    const demoUser = await prisma.user.findUnique({
      where: { email: 'demo@erp-system.com' },
    });

    if (!demoUser) {
      console.log('❌ Demo user not found');
      return;
    }

    console.log(`✅ Found demo user: ${demoUser.id}`);

    // Get or create default tenant
    let demoTenant = await prisma.tenant.findUnique({
      where: { id: 'default' },
    });

    if (!demoTenant) {
      demoTenant = await prisma.tenant.create({
        data: {
          id: 'default',
          tenantCode: 'DEFAULT',
          name: 'Default Tenant',
          nameAr: 'المستأجر الافتراضي',
          status: 'active',
        },
      });
      console.log('✅ Created default tenant');
    } else {
      console.log('✅ Found existing default tenant');
    }

    // Get demo role
    const demoRole = await prisma.role.findUnique({
      where: { code: 'demo' },
    });

    if (!demoRole) {
      console.log('❌ Demo role not found');
      return;
    }

    console.log(`✅ Found demo role: ${demoRole.id}`);

    // Check if UserTenantRole already exists
    const existingUserTenantRole = await prisma.userTenantRole.findUnique({
      where: {
        userId_tenantId_roleId: {
          userId: demoUser.id,
          tenantId: demoTenant.id,
          roleId: demoRole.id,
        },
      },
    });

    if (existingUserTenantRole) {
      console.log('⚠️ UserTenantRole already exists, deleting...');
      await prisma.userTenantRole.delete({
        where: {
          userId_tenantId_roleId: {
            userId: demoUser.id,
            tenantId: demoTenant.id,
            roleId: demoRole.id,
          },
        },
      });
    }

    // Create UserTenantRole
    const userTenantRole = await prisma.userTenantRole.create({
      data: {
        userId: demoUser.id,
        tenantId: demoTenant.id,
        roleId: demoRole.id,
      },
    });

    console.log('✅ UserTenantRole created successfully');
    console.log(`   User: ${demoUser.email}`);
    console.log(`   Tenant: ${demoTenant.name}`);
    console.log(`   Role: ${demoRole.nameEn}`);

    console.log('\n✅ Tenant assignment fixed successfully!');
  } catch (error) {
    console.error('❌ Error fixing tenant assignment:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
