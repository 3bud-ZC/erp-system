const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Starting authentication data seeding...\n');

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists. Skipping auth seed.');
    return;
  }

  console.log('👤 Creating admin user...');
  
  // Create admin role first
  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: {},
    create: {
      code: 'admin',
      nameAr: 'مدير النظام',
      nameEn: 'System Administrator',
      description: 'Full system access',
    },
  });

  // Hash password
  const hashedPassword = await bcrypt.hash('admin12345', 10);

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'مدير النظام',
      password: hashedPassword,
      isActive: true,
    },
  });

  // Assign admin role to user
  await prisma.userRole.create({
    data: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  console.log('✅ Admin user created successfully!');
  console.log('   Email: admin@example.com');
  console.log('   Password: admin12345');
  console.log('\n✨ Authentication data seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Auth seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
