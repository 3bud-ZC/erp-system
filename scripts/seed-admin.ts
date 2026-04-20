/**
 * Seed default admin user
 * Run this script to create the default admin account
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

async function seedAdmin() {
  try {
    console.log('🌱 Starting admin seed...');

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@erp.com' },
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      console.log('   Email: admin@erp.com');
      console.log('   Password: admin123');
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword('admin123');

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'admin@erp.com',
        name: 'System Administrator',
        password: hashedPassword,
        isActive: true,
      },
    });

    console.log('✅ Admin user created successfully');
    console.log('   Email: admin@erp.com');
    console.log('   Password: admin123');

    // Assign ADMIN role
    const adminRole = await prisma.role.findUnique({
      where: { code: 'admin' },
    });

    if (adminRole) {
      await prisma.userRole.create({
        data: {
          userId: admin.id,
          roleId: adminRole.id,
        },
      });
      console.log('✅ ADMIN role assigned to admin user');
    } else {
      console.warn('⚠️  ADMIN role not found, please seed roles first');
    }

    console.log('🎉 Admin seed completed successfully');
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
