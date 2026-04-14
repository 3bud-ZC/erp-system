import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 بدء إضافة البيانات التجريبية...');

  // حذف البيانات القديمة
  await prisma.salesInvoiceItem.deleteMany();
  await prisma.purchaseInvoiceItem.deleteMany();
  await prisma.salesInvoice.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();

  // إضافة موردين
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        code: 'SUP001',
        nameAr: 'شركة البلاستيك المتحدة',
        nameEn: 'United Plastics Company',
        phone: '01012345678',
        email: 'info@unitedplastics.com',
        address: 'القاهرة، مصر',
        taxNumber: 'TAX-001',
      },
    }),
    prisma.supplier.create({
      data: {
        code: 'SUP002',
        nameAr: 'مصنع الخامات الحديثة',
        nameEn: 'Modern Materials Factory',
        phone: '01098765432',
        email: 'sales@modernmaterials.com',
        address: 'الإسكندرية، مصر',
        taxNumber: 'TAX-002',
      },
    }),
    prisma.supplier.create({
      data: {
        code: 'SUP003',
        nameAr: 'شركة النيل للمواد الخام',
        nameEn: 'Nile Raw Materials',
        phone: '01055555555',
        email: 'contact@nileraw.com',
        address: 'الجيزة، مصر',
        taxNumber: 'TAX-003',
      },
    }),
  ]);

  console.log('✅ تم إضافة الموردين');

  // إضافة عملاء
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        code: 'CUS001',
        nameAr: 'شركة التوزيع الوطنية',
        nameEn: 'National Distribution Co.',
        phone: '01111111111',
        email: 'orders@nationaldist.com',
        address: 'القاهرة، مصر',
        taxNumber: 'TAX-C001',
      },
    }),
    prisma.customer.create({
      data: {
        code: 'CUS002',
        nameAr: 'مؤسسة الأمل التجارية',
        nameEn: 'Al-Amal Trading',
        phone: '01222222222',
        email: 'info@alamal.com',
        address: 'الإسكندرية، مصر',
        taxNumber: 'TAX-C002',
      },
    }),
    prisma.customer.create({
      data: {
        code: 'CUS003',
        nameAr: 'شركة النجاح للتجارة',
        nameEn: 'Success Trading Co.',
        phone: '01333333333',
        email: 'sales@success.com',
        address: 'طنطا، مصر',
        taxNumber: 'TAX-C003',
      },
    }),
  ]);

  console.log('✅ تم إضافة العملاء');

  // إضافة منتجات (خامات ومنتجات نهائية)
  const products = await Promise.all([
    // خامات
    prisma.product.create({
      data: {
        code: 'RAW001',
        nameAr: 'حبيبات بولي إيثيلين',
        nameEn: 'Polyethylene Granules',
        type: 'raw_material',
        unit: 'كجم',
        price: 45.00,
        cost: 35.00,
        stock: 500,
        minStock: 100,
      },
    }),
    prisma.product.create({
      data: {
        code: 'RAW002',
        nameAr: 'حبيبات بولي بروبلين',
        nameEn: 'Polypropylene Granules',
        type: 'raw_material',
        unit: 'كجم',
        price: 50.00,
        cost: 40.00,
        stock: 300,
        minStock: 80,
      },
    }),
    prisma.product.create({
      data: {
        code: 'RAW003',
        nameAr: 'مادة ملونة حمراء',
        nameEn: 'Red Colorant',
        type: 'raw_material',
        unit: 'كجم',
        price: 120.00,
        cost: 100.00,
        stock: 50,
        minStock: 20,
      },
    }),
    prisma.product.create({
      data: {
        code: 'RAW004',
        nameAr: 'مادة ملونة زرقاء',
        nameEn: 'Blue Colorant',
        type: 'raw_material',
        unit: 'كجم',
        price: 120.00,
        cost: 100.00,
        stock: 45,
        minStock: 20,
      },
    }),
    // منتجات نهائية
    prisma.product.create({
      data: {
        code: 'FIN001',
        nameAr: 'أكياس بلاستيك صغيرة',
        nameEn: 'Small Plastic Bags',
        type: 'finished_product',
        unit: 'كيس',
        price: 2.50,
        cost: 1.50,
        stock: 1000,
        minStock: 200,
      },
    }),
    prisma.product.create({
      data: {
        code: 'FIN002',
        nameAr: 'أكياس بلاستيك كبيرة',
        nameEn: 'Large Plastic Bags',
        type: 'finished_product',
        unit: 'كيس',
        price: 4.00,
        cost: 2.50,
        stock: 800,
        minStock: 150,
      },
    }),
    prisma.product.create({
      data: {
        code: 'FIN003',
        nameAr: 'علب بلاستيك للطعام',
        nameEn: 'Plastic Food Containers',
        type: 'finished_product',
        unit: 'علبة',
        price: 8.00,
        cost: 5.00,
        stock: 600,
        minStock: 100,
      },
    }),
    prisma.product.create({
      data: {
        code: 'FIN004',
        nameAr: 'زجاجات بلاستيك 1 لتر',
        nameEn: '1L Plastic Bottles',
        type: 'finished_product',
        unit: 'زجاجة',
        price: 6.50,
        cost: 4.00,
        stock: 500,
        minStock: 100,
      },
    }),
  ]);

  console.log('✅ تم إضافة المنتجات');

  // إضافة فواتير شراء
  const purchaseInvoice1 = await prisma.purchaseInvoice.create({
    data: {
      invoiceNumber: 'PI-2024-001',
      supplierId: suppliers[0].id,
      date: new Date('2024-01-15'),
      status: 'completed',
      total: 17500.00,
      notes: 'شحنة خامات شهر يناير',
      items: {
        create: [
          {
            productId: products[0].id,
            quantity: 500,
            price: 35.00,
            total: 17500.00,
          },
        ],
      },
    },
  });

  const purchaseInvoice2 = await prisma.purchaseInvoice.create({
    data: {
      invoiceNumber: 'PI-2024-002',
      supplierId: suppliers[1].id,
      date: new Date('2024-02-10'),
      status: 'completed',
      total: 17000.00,
      notes: 'شحنة خامات شهر فبراير',
      items: {
        create: [
          {
            productId: products[1].id,
            quantity: 300,
            price: 40.00,
            total: 12000.00,
          },
          {
            productId: products[2].id,
            quantity: 50,
            price: 100.00,
            total: 5000.00,
          },
        ],
      },
    },
  });

  console.log('✅ تم إضافة فواتير الشراء');

  // إضافة فواتير بيع
  const salesInvoice1 = await prisma.salesInvoice.create({
    data: {
      invoiceNumber: 'SI-2024-001',
      customerId: customers[0].id,
      date: new Date('2024-02-20'),
      status: 'completed',
      total: 5000.00,
      notes: 'طلبية شهر فبراير',
      items: {
        create: [
          {
            productId: products[4].id,
            quantity: 2000,
            price: 2.50,
            total: 5000.00,
          },
        ],
      },
    },
  });

  const salesInvoice2 = await prisma.salesInvoice.create({
    data: {
      invoiceNumber: 'SI-2024-002',
      customerId: customers[1].id,
      date: new Date('2024-03-05'),
      status: 'completed',
      total: 8000.00,
      notes: 'طلبية شهر مارس',
      items: {
        create: [
          {
            productId: products[5].id,
            quantity: 2000,
            price: 4.00,
            total: 8000.00,
          },
        ],
      },
    },
  });

  const salesInvoice3 = await prisma.salesInvoice.create({
    data: {
      invoiceNumber: 'SI-2024-003',
      customerId: customers[2].id,
      date: new Date('2024-03-15'),
      status: 'completed',
      total: 7800.00,
      notes: 'طلبية متنوعة',
      items: {
        create: [
          {
            productId: products[6].id,
            quantity: 600,
            price: 8.00,
            total: 4800.00,
          },
          {
            productId: products[7].id,
            quantity: 500,
            price: 6.00,
            total: 3000.00,
          },
        ],
      },
    },
  });

  console.log('✅ تم إضافة فواتير البيع');

  // إضافة مصروفات
  await Promise.all([
    prisma.expense.create({
      data: {
        expenseNumber: 'EXP-001',
        category: 'رواتب',
        description: 'رواتب شهر يناير',
        amount: 15000.00,
        date: new Date('2024-01-31'),
        notes: 'رواتب الموظفين',
      },
    }),
    prisma.expense.create({
      data: {
        expenseNumber: 'EXP-002',
        category: 'كهرباء',
        description: 'فاتورة كهرباء يناير',
        amount: 3500.00,
        date: new Date('2024-02-05'),
        notes: 'استهلاك المصنع',
      },
    }),
    prisma.expense.create({
      data: {
        expenseNumber: 'EXP-003',
        category: 'صيانة',
        description: 'صيانة ماكينة الحقن',
        amount: 2000.00,
        date: new Date('2024-02-15'),
        notes: 'صيانة دورية',
      },
    }),
    prisma.expense.create({
      data: {
        expenseNumber: 'EXP-004',
        category: 'نقل',
        description: 'مصاريف نقل البضائع',
        amount: 1500.00,
        date: new Date('2024-03-01'),
        notes: 'توصيل للعملاء',
      },
    }),
  ]);

  console.log('✅ تم إضافة المصروفات');

  console.log('\n🎉 تم إضافة جميع البيانات التجريبية بنجاح!');
  console.log('\n📊 ملخص البيانات:');
  console.log(`- ${suppliers.length} موردين`);
  console.log(`- ${customers.length} عملاء`);
  console.log(`- ${products.length} منتجات`);
  console.log('- 2 فاتورة شراء');
  console.log('- 3 فواتير بيع');
  console.log('- 4 مصروفات');

  // إضافة بيانات المصادقة (Admin user)
  console.log('\n🔐 إضافة بيانات المصادقة...');
  try {
    const { execSync } = require('child_process');
    execSync('npx tsx prisma/seed-auth.ts', { stdio: 'inherit' });
    console.log('✅ تم إضافة بيانات المصادقة بنجاح!');
  } catch (error) {
    console.log('⚠️ لم يتم إضافة بيانات المصادقة (قد تكون موجودة مسبقاً)');
  }
}

main()
  .catch((e) => {
    console.error('❌ خطأ في إضافة البيانات:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
