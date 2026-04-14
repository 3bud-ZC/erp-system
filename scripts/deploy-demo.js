const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createDemoUser() {
  try {
    // Create demo role
    const demoRole = await prisma.role.upsert({
      where: { code: 'demo' },
      update: {},
      create: {
        code: 'demo',
        nameAr: 'demo',
        nameEn: 'Demo User',
        description: 'Demo access for testing',
      },
    });

    // Create permissions for demo user
    const permissions = [
      'view_dashboard', 'view_products', 'create_product', 'update_product', 'delete_product',
      'view_warehouses', 'create_warehouse', 'update_warehouse', 'delete_warehouse',
      'view_customers', 'view_suppliers', 'view_sales', 'view_purchases', 'view_reports'
    ];

    for (const permCode of permissions) {
      // Extract module from permission code
      const module = permCode.includes('dashboard') ? 'dashboard' :
                    permCode.includes('product') || permCode.includes('warehouse') ? 'inventory' :
                    permCode.includes('customer') || permCode.includes('sales') ? 'sales' :
                    permCode.includes('supplier') || permCode.includes('purchase') ? 'purchases' :
                    permCode.includes('report') ? 'reports' : 'general';
      
      // Extract action from permission code
      const action = permCode.includes('create') ? 'create' :
                    permCode.includes('update') ? 'update' :
                    permCode.includes('delete') ? 'delete' : 'read';

      await prisma.permission.upsert({
        where: { code: permCode },
        update: {},
        create: {
          code: permCode,
          nameAr: permCode,
          nameEn: permCode,
          description: `Permission for ${permCode}`,
          module,
          action,
        },
      });

      // Assign permission to role
      const permission = await prisma.permission.findUnique({ where: { code: permCode } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: demoRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: demoRole.id,
            permissionId: permission.id,
          },
        });
      }
    }

    // Create demo user
    const hashedPassword = await bcrypt.hash('demo12345', 10);
    
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo@erp-system.com' },
      update: {},
      create: {
        email: 'demo@erp-system.com',
        name: 'Demo User',
        password: hashedPassword,
        isActive: true,
      },
    });

    // Assign demo role to user
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: demoUser.id, roleId: demoRole.id } },
      update: {},
      create: {
        userId: demoUser.id,
        roleId: demoRole.id,
      },
    });

    console.log('Demo user created successfully!');
    console.log('Email: demo@erp-system.com');
    console.log('Password: demo12345');
    
  } catch (error) {
    console.error('Error creating demo user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDemoUser();
