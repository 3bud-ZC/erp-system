import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Initialize system settings
  const existing = await (prisma as any).systemSettings.findFirst().catch(() => null);
  if (!existing) {
    await (prisma as any).systemSettings.create({
      data: { initialized: true, locked: false, productionMode: false }
    });
    console.log('✓ System settings created (initialized=true)');
  } else {
    await (prisma as any).systemSettings.update({
      where: { id: existing.id },
      data: { initialized: true }
    });
    console.log('✓ System settings updated (initialized=true)');
  }

  // 2. Create admin user if not exists
  const existingUser = await prisma.user.findUnique({ where: { email: 'admin@erp.com' } }).catch(() => null);
  if (!existingUser) {
    const hashed = await bcrypt.hash('Admin@2026', 10);
    await prisma.user.create({
      data: { email: 'admin@erp.com', name: 'System Admin', password: hashed, isActive: true }
    });
    console.log('✓ Admin user created');
  } else {
    const hashed = await bcrypt.hash('Admin@2026', 10);
    await prisma.user.update({
      where: { email: 'admin@erp.com' },
      data: { password: hashed, isActive: true }
    });
    console.log('✓ Admin user password updated');
  }

  console.log('\n=== LOGIN CREDENTIALS ===');
  console.log('Email:    admin@erp.com');
  console.log('Password: Admin@2026');
}

main().catch(console.error).finally(() => prisma.$disconnect());
