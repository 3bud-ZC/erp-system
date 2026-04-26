const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

// 🛡️  PRODUCTION SAFETY GUARD — only allow seed in dev or with explicit opt-in
function assertSeedAllowed() {
  const isDev = process.env.NODE_ENV === 'development';
  const explicit = process.env.ALLOW_SEED === 'true';
  if (isDev || explicit) return;
  throw new Error(
    '❌ Seeding is disabled in this environment. ' +
      'Set NODE_ENV=development or ALLOW_SEED=true to allow it.'
  );
}

async function main() {
  assertSeedAllowed();

  console.log('🌱 Starting database seeding...\n');

  try {
    // Check if data already exists
    const productCount = await prisma.product.count();
    if (productCount > 0) {
      console.log('✅ Database already has data. Skipping seed.');
      return;
    }

    console.log('📦 Creating sample products...');
    
    // Create products
    const products = await Promise.all([
      prisma.product.create({
        data: {
          code: 'P001',
          nameAr: 'قهوة عربية',
          nameEn: 'Arabic Coffee',
          type: 'finished',
          unit: 'كيلو',
          price: 150,
          cost: 100,
          stock: 50,
          minStock: 10,
        },
      }),
      prisma.product.create({
        data: {
          code: 'P002',
          nameAr: 'شاي أخضر',
          nameEn: 'Green Tea',
          type: 'finished',
          unit: 'كيلو',
          price: 80,
          cost: 50,
          stock: 100,
          minStock: 20,
        },
      }),
      prisma.product.create({
        data: {
          code: 'P003',
          nameAr: 'سكر',
          nameEn: 'Sugar',
          type: 'raw',
          unit: 'كيلو',
          price: 25,
          cost: 20,
          stock: 200,
          minStock: 50,
        },
      }),
    ]);
    console.log(`✅ Created ${products.length} products`);

    console.log('👥 Creating sample customers...');
    const customers = await Promise.all([
      prisma.customer.create({
        data: {
          code: 'C001',
          nameAr: 'مقهى الأصالة',
          nameEn: 'Authenticity Cafe',
          phone: '0501234567',
          email: 'info@authenticity.com',
          address: 'الرياض، المملكة العربية السعودية',
        },
      }),
      prisma.customer.create({
        data: {
          code: 'C002',
          nameAr: 'مطعم النخيل',
          nameEn: 'Palm Restaurant',
          phone: '0507654321',
          email: 'contact@palm.com',
          address: 'جدة، المملكة العربية السعودية',
        },
      }),
    ]);
    console.log(`✅ Created ${customers.length} customers`);

    console.log('🏭 Creating sample suppliers...');
    const suppliers = await Promise.all([
      prisma.supplier.create({
        data: {
          code: 'S001',
          nameAr: 'مؤسسة القهوة البرازيلية',
          nameEn: 'Brazilian Coffee Co',
          phone: '0551234567',
          email: 'sales@braziliancoffee.com',
          address: 'البرازيل',
        },
      }),
      prisma.supplier.create({
        data: {
          code: 'S002',
          nameAr: 'شركة الشاي الصيني',
          nameEn: 'Chinese Tea Company',
          phone: '0557654321',
          email: 'info@chinesetea.com',
          address: 'الصين',
        },
      }),
    ]);
    console.log(`✅ Created ${suppliers.length} suppliers`);

    console.log('🏢 Creating sample warehouse...');
    const warehouse = await prisma.warehouse.create({
      data: {
        code: 'WH001',
        nameAr: 'المخزن الرئيسي',
        nameEn: 'Main Warehouse',
        address: 'الرياض، المملكة العربية السعودية',
        phone: '0501111111',
        manager: 'أحمد محمد',
      },
    });
    console.log('✅ Created warehouse');

    // Seed authentication data
    console.log('\n🔐 Seeding authentication data...');
    try {
      execSync('node prisma/seed-auth.js', { stdio: 'inherit' });
      console.log('✅ Authentication data seeded successfully!');
    } catch (error) {
      console.log('⚠️  Authentication seed skipped (may already exist)');
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - ${products.length} products`);
    console.log(`  - ${customers.length} customers`);
    console.log(`  - ${suppliers.length} suppliers`);
    console.log(`  - 1 warehouse`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
