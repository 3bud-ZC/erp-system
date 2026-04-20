import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function GET() {
  try {
    console.log('🚀 Starting database initialization...');

    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');

    // Check if already initialized (prevent re-initialization)
    const existingDemoUser = await prisma.user.findUnique({
      where: { email: 'demo@erp-system.com' },
    });

    if (existingDemoUser) {
      console.log('⚠️ Database already initialized. Skipping initialization.');
      return NextResponse.json({
        success: true,
        message: 'Database already initialized',
        data: {
          demoUser: {
            email: existingDemoUser.email
          },
          skipped: true
        }
      });
    }

    // Create demo role
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
    console.log('✅ Demo role created');

    // Create all permissions
    const permissions = [
      // Dashboard
      'view_dashboard',
      // Products & Inventory
      'view_products', 'create_product', 'update_product', 'delete_product',
      // Warehouses
      'view_warehouses', 'create_warehouse', 'update_warehouse', 'delete_warehouse',
      // Customers
      'view_customers', 'create_customer', 'update_customer', 'delete_customer',
      // Suppliers
      'view_suppliers', 'create_supplier', 'update_supplier', 'delete_supplier',
      // Sales Invoices
      'view_sales', 'read_sales_invoice', 'create_sales_invoice', 'update_sales_invoice', 'delete_sales_invoice',
      // Purchase Invoices
      'view_purchases', 'read_purchase_invoice', 'create_purchase_invoice', 'update_purchase_invoice', 'delete_purchase_invoice',
      // Production Orders
      'view_manufacturing', 'read_production_order', 'create_production_order', 'update_production_order', 'delete_production_order',
      // Accounting
      'view_accounting', 'manage_accounts',
      // Reports
      'view_reports', 'view_financial_reports',
    ];

    for (const permCode of permissions) {
      const moduleName = permCode.includes('dashboard') ? 'dashboard' :
                    permCode.includes('product') || permCode.includes('warehouse') ? 'inventory' :
                    permCode.includes('customer') ? 'sales' :
                    permCode.includes('sales') ? 'sales' :
                    permCode.includes('supplier') ? 'purchases' :
                    permCode.includes('purchase') ? 'purchases' :
                    permCode.includes('production') || permCode.includes('manufacturing') ? 'manufacturing' :
                    permCode.includes('report') || permCode.includes('financial') ? 'reports' :
                    permCode.includes('accounting') || permCode.includes('account') ? 'accounting' : 'general';
      
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
          description: `Permission for ${permCode}`,
          module: moduleName,
          action,
        },
      });

      // Link permission to role
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
    console.log('✅ Permissions created and linked');

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
    console.log('✅ Demo user created');

    // Assign role to user
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: demoUser.id, roleId: demoRole.id } },
      update: {},
      create: {
        userId: demoUser.id,
        roleId: demoRole.id,
      },
    });
    console.log('✅ Role assigned to user');

    // Create sample data
    const sampleProducts = [
      { code: 'PROD-001', nameAr: 'منتج تجريبي 1', nameEn: 'Sample Product 1', type: 'finished', unit: 'piece', price: 100, cost: 50, stock: 10, minStock: 5 },
      { code: 'PROD-002', nameAr: 'منتج تجريبي 2', nameEn: 'Sample Product 2', type: 'raw', unit: 'kg', price: 50, cost: 25, stock: 20, minStock: 10 },
    ];

    for (const product of sampleProducts) {
      await prisma.product.upsert({
        where: { code: product.code },
        update: {},
        create: product,
      });
    }
    console.log('✅ Sample products created');

    // Create sample warehouse
    await prisma.warehouse.upsert({
      where: { code: 'MAIN' },
      update: {},
      create: {
        code: 'MAIN',
        nameAr: 'المخزن الرئيسي',
        nameEn: 'Main Warehouse',
        address: 'شارع التحرير، القاهرة',
        phone: '01000000000',
        manager: 'مدير المخزن',
      },
    });
    console.log('✅ Sample warehouse created');

    // Create sample customers
    await prisma.customer.upsert({
      where: { id: 'customer-1' },
      update: {},
      create: {
        id: 'customer-1',
        code: 'CUST-001',
        nameAr: 'عميل تجريبي',
        nameEn: 'Demo Customer',
        email: 'customer@example.com',
        phone: '01001234567',
        address: 'القاهرة',
      },
    });
    console.log('✅ Sample customer created');

    // Create sample suppliers
    await prisma.supplier.upsert({
      where: { id: 'supplier-1' },
      update: {},
      create: {
        id: 'supplier-1',
        code: 'SUP-001',
        nameAr: 'مورد تجريبي',
        nameEn: 'Demo Supplier',
        email: 'supplier@example.com',
        phone: '01101234567',
        address: 'القاهرة',
      },
    });
    console.log('✅ Sample supplier created');

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      data: {
        demoUser: {
          email: 'demo@erp-system.com'
        },
        products: 2,
        warehouse: 1,
        customer: 1,
        supplier: 1
      }
    });

  } catch (error: any) {
    console.error('❌ Initialization error:', error);
    return NextResponse.json({
      success: false,
      message: 'فشل في تهيئة قاعدة البيانات',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
