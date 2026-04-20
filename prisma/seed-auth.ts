/**
 * Seed script for authentication and authorization data
 * Creates default roles and permissions
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting authentication data seeding...');

  try {
    // Define permissions
    const permissions = [
      // Inventory permissions
      { code: 'create_product', nameAr: 'إنشاء منتج', module: 'inventory', action: 'create' },
      { code: 'read_product', nameAr: 'عرض المنتجات', module: 'inventory', action: 'read' },
      { code: 'update_product', nameAr: 'تعديل المنتج', module: 'inventory', action: 'update' },
      { code: 'delete_product', nameAr: 'حذف المنتج', module: 'inventory', action: 'delete' },

      // Sales permissions
      { code: 'create_sales_invoice', nameAr: 'إنشاء فاتورة بيع', module: 'sales', action: 'create' },
      { code: 'read_sales_invoice', nameAr: 'عرض فواتير البيع', module: 'sales', action: 'read' },
      { code: 'update_sales_invoice', nameAr: 'تعديل فاتورة البيع', module: 'sales', action: 'update' },
      { code: 'delete_sales_invoice', nameAr: 'حذف فاتورة البيع', module: 'sales', action: 'delete' },
      { code: 'view_sales_reports', nameAr: 'عرض تقارير المبيعات', module: 'sales', action: 'read' },

      // Purchase permissions
      { code: 'create_purchase_invoice', nameAr: 'إنشاء فاتورة شراء', module: 'purchases', action: 'create' },
      { code: 'read_purchase_invoice', nameAr: 'عرض فواتير الشراء', module: 'purchases', action: 'read' },
      { code: 'update_purchase_invoice', nameAr: 'تعديل فاتورة الشراء', module: 'purchases', action: 'update' },
      { code: 'delete_purchase_invoice', nameAr: 'حذف فاتورة الشراء', module: 'purchases', action: 'delete' },

      // Manufacturing permissions
      { code: 'create_production_order', nameAr: 'إنشاء أمر إنتاج', module: 'manufacturing', action: 'create' },
      { code: 'read_production_order', nameAr: 'عرض أوامر الإنتاج', module: 'manufacturing', action: 'read' },
      { code: 'update_production_order', nameAr: 'تعديل أمر الإنتاج', module: 'manufacturing', action: 'update' },
      { code: 'delete_production_order', nameAr: 'حذف أمر الإنتاج', module: 'manufacturing', action: 'delete' },

      // Accounting permissions
      { code: 'view_accounting', nameAr: 'عرض المحاسبة', module: 'accounting', action: 'read' },
      { code: 'view_financial_reports', nameAr: 'عرض التقارير المالية', module: 'accounting', action: 'read' },
      { code: 'manage_accounts', nameAr: 'إدارة الحسابات', module: 'accounting', action: 'update' },

      // User management permissions
      { code: 'manage_users', nameAr: 'إدارة المستخدمين', module: 'auth', action: 'update' },
      { code: 'manage_roles', nameAr: 'إدارة الأدوار', module: 'auth', action: 'update' },
      { code: 'view_audit_logs', nameAr: 'عرض سجلات التدقيق', module: 'auth', action: 'read' },
    ];

    // Create permissions
    console.log('📝 Creating permissions...');
    for (const permission of permissions) {
      await prisma.permission.upsert({
        where: { code: permission.code },
        update: {},
        create: {
          code: permission.code,
          nameAr: permission.nameAr,
          nameEn: permission.code.replace(/_/g, ' '),
          module: permission.module,
          action: permission.action,
          isActive: true,
        },
      });
    }
    console.log(`✅ Created ${permissions.length} permissions`);

    // Define roles
    const roles = [
      {
        code: 'admin',
        nameAr: 'مدير النظام',
        description: 'لديه صلاحيات كاملة على جميع أجزاء النظام',
        permissions: permissions.map((p) => p.code), // All permissions
      },
      {
        code: 'manager',
        nameAr: 'مدير',
        description: 'يمكنه إدارة المبيعات والمشتريات والمخزون',
        permissions: [
          'read_product',
          'create_sales_invoice',
          'read_sales_invoice',
          'update_sales_invoice',
          'create_purchase_invoice',
          'read_purchase_invoice',
          'update_purchase_invoice',
          'view_sales_reports',
          'view_accounting',
          'view_financial_reports',
        ],
      },
      {
        code: 'accountant',
        nameAr: 'محاسب',
        description: 'يمكنه عرض وإدارة الحسابات والتقارير المالية',
        permissions: [
          'read_product',
          'read_sales_invoice',
          'read_purchase_invoice',
          'view_accounting',
          'view_financial_reports',
          'manage_accounts',
          'view_audit_logs',
        ],
      },
      {
        code: 'inventory_manager',
        nameAr: 'مدير المخزون',
        description: 'يمكنه إدارة المنتجات والمخزون',
        permissions: [
          'create_product',
          'read_product',
          'update_product',
          'read_sales_invoice',
          'read_purchase_invoice',
        ],
      },
      {
        code: 'sales_rep',
        nameAr: 'ممثل مبيعات',
        description: 'يمكنه إنشاء وعرض فواتير المبيعات',
        permissions: [
          'read_product',
          'create_sales_invoice',
          'read_sales_invoice',
          'view_sales_reports',
        ],
      },
      {
        code: 'purchase_officer',
        nameAr: 'موظف المشتريات',
        description: 'يمكنه إدارة فواتير المشتريات',
        permissions: [
          'read_product',
          'create_purchase_invoice',
          'read_purchase_invoice',
          'update_purchase_invoice',
        ],
      },
    ];

    // Create roles and assign permissions
    console.log('👥 Creating roles...');
    for (const role of roles) {
      const createdRole = await prisma.role.upsert({
        where: { code: role.code },
        update: {},
        create: {
          code: role.code,
          nameAr: role.nameAr,
          nameEn: role.code,
          description: role.description,
          isActive: true,
        },
      });

      // Assign permissions to role
      for (const permissionCode of role.permissions) {
        const permission = await prisma.permission.findUnique({
          where: { code: permissionCode },
        });

        if (permission) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: createdRole.id,
                permissionId: permission.id,
              },
            },
            update: {},
            create: {
              roleId: createdRole.id,
              permissionId: permission.id,
            },
          });
        }
      }
    }
    console.log(`✅ Created ${roles.length} roles with permissions`);

    // Create default admin user
    console.log('👤 Creating admin user...');
    const adminRole = await prisma.role.findUnique({
      where: { code: 'admin' },
    });

    if (adminRole) {
      const hashedPassword = await bcrypt.hash('admin12345', 10);

      const adminUser = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
          email: 'admin@example.com',
          name: 'مدير النظام',
          password: hashedPassword,
          isActive: true,
        },
      });

      // Assign admin role to user
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: adminUser.id,
            roleId: adminRole.id,
          },
        },
        update: {},
        create: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      });

      console.log('✅ Admin user created: admin@example.com / admin12345');
    }

    console.log('✨ Authentication data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding authentication data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
