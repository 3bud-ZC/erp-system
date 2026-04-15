import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function GET() {
  try {
    console.log('Starting setup...');

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
    console.log('Demo role created/updated');

    // Create ALL permissions required by API routes
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
    console.log('Permissions created');

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
    console.log('Demo user created');

    // Assign role to user
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: demoUser.id, roleId: demoRole.id } },
      update: {},
      create: {
        userId: demoUser.id,
        roleId: demoRole.id,
      },
    });
    console.log('Role assigned to user');

    // Create sample products
    const sampleProducts = [
      { code: 'PROD-001', nameAr: 'منتج تجريبي 1', type: 'finished', unit: 'piece', price: 100, cost: 50, stock: 10, minStock: 5 },
      { code: 'PROD-002', nameAr: 'منتج تجريبي 2', type: 'raw', unit: 'kg', price: 50, cost: 25, stock: 20, minStock: 10 },
    ];

    for (const product of sampleProducts) {
      await prisma.product.upsert({
        where: { code: product.code },
        update: {},
        create: product,
      });
    }
    console.log('Sample products created');

    return NextResponse.json({
      success: true,
      message: 'Setup completed successfully',
      demoUser: {
        email: 'demo@erp-system.com'
      }
    });

  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json({
      success: false,
      message: 'فشل في إعداد النظام',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
