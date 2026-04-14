#!/usr/bin/env node

/**
 * Railway Database Initialization Script
 * This script runs during deployment to ensure database is ready
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function initializeDatabase() {
  console.log('🚀 Starting Railway database initialization...\n');

  try {
    // Test connection
    console.log('1️⃣ Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('   ✅ Database connected successfully\n');

    // Push schema
    console.log('2️⃣ Pushing Prisma schema...');
    const { execSync } = require('child_process');
    try {
      execSync('npx prisma db push --accept-data-loss', {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('   ✅ Schema pushed successfully\n');
    } catch (e) {
      console.log('   ⚠️ Schema push warning (may already exist)\n');
    }

    // Create demo role
    console.log('3️⃣ Creating demo role...');
    const demoRole = await prisma.role.upsert({
      where: { code: 'demo' },
      update: {},
      create: {
        code: 'demo',
        nameAr: 'مستخدم تجريبي',
        nameEn: 'Demo User',
        description: 'Demo access for testing',
      },
    });
    console.log('   ✅ Demo role ready\n');

    // Create permissions
    console.log('4️⃣ Creating permissions...');
    const permissions = [
      'view_dashboard', 'view_products', 'create_product', 'update_product', 'delete_product',
      'view_warehouses', 'create_warehouse', 'update_warehouse', 'delete_warehouse',
      'view_customers', 'create_customer', 'update_customer', 'delete_customer',
      'view_suppliers', 'create_supplier', 'update_supplier', 'delete_supplier',
      'view_sales', 'create_sales', 'update_sales', 'delete_sales',
      'view_purchases', 'create_purchase', 'update_purchase', 'delete_purchase',
      'view_reports', 'view_accounting', 'view_manufacturing'
    ];

    for (const permCode of permissions) {
      const module = permCode.includes('dashboard') ? 'dashboard' :
                    permCode.includes('product') || permCode.includes('warehouse') ? 'inventory' :
                    permCode.includes('customer') || permCode.includes('sales') ? 'sales' :
                    permCode.includes('supplier') || permCode.includes('purchase') ? 'purchases' :
                    permCode.includes('report') ? 'reports' :
                    permCode.includes('accounting') ? 'accounting' :
                    permCode.includes('manufacturing') ? 'manufacturing' : 'general';
      
      const action = permCode.includes('create') ? 'create' :
                    permCode.includes('update') ? 'update' :
                    permCode.includes('delete') ? 'delete' : 'read';

      const permission = await prisma.permission.upsert({
        where: { code: permCode },
        update: {},
        create: {
          code: permCode,
          nameAr: permCode,
          nameEn: permCode,
          module,
          action,
        },
      });

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
    console.log(`   ✅ ${permissions.length} permissions created\n`);

    // Create demo user
    console.log('5️⃣ Creating demo user...');
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
    console.log('   ✅ Demo user created\n');

    // Assign role
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: demoUser.id, roleId: demoRole.id } },
      update: {},
      create: {
        userId: demoUser.id,
        roleId: demoRole.id,
      },
    });

    // Create sample data
    console.log('6️⃣ Creating sample data...');
    
    // Products
    await prisma.product.upsert({
      where: { code: 'SAMPLE-001' },
      update: {},
      create: {
        code: 'SAMPLE-001',
        nameAr: 'منتج تجريبي 1',
        nameEn: 'Sample Product 1',
        type: 'finished',
        unit: 'piece',
        price: 100,
        cost: 50,
        stock: 100,
        minStock: 10,
      },
    });

    // Warehouse
    await prisma.warehouse.upsert({
      where: { code: 'MAIN' },
      update: {},
      create: {
        code: 'MAIN',
        nameAr: 'المخزن الرئيسي',
        nameEn: 'Main Warehouse',
        address: 'شارع التحرير، القاهرة',
        phone: '01000000000',
      },
    });

    console.log('   ✅ Sample data created\n');

    console.log('🎉 DATABASE INITIALIZATION COMPLETE!\n');
    console.log('═══════════════════════════════════════');
    console.log('Demo User:');
    console.log('  Email: demo@erp-system.com');
    console.log('  Password: demo12345');
    console.log('═══════════════════════════════════════\n');

    return { success: true };

  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initializeDatabase();
