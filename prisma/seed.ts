import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// 🛡️  PRODUCTION SAFETY GUARD
// ----------------------------------------------------------------------------
// This seed performs `deleteMany()` against business tables (customers,
// products, accounts, journalEntries, ...). Running it against a real DB
// would WIPE production data. Block by default unless one of:
//   - NODE_ENV === 'development', OR
//   - ALLOW_SEED === 'true' (explicit opt-in)
// ============================================================================
function assertSeedAllowed(): void {
  const isDev = process.env.NODE_ENV === 'development';
  const explicit = process.env.ALLOW_SEED === 'true';
  if (isDev || explicit) return;

  const reason =
    `❌ Seeding is disabled in this environment.\n` +
    `   NODE_ENV='${process.env.NODE_ENV ?? '(unset)'}' ALLOW_SEED='${process.env.ALLOW_SEED ?? '(unset)'}'\n` +
    `   This script wipes business tables. To allow it on purpose, set\n` +
    `   either NODE_ENV=development or ALLOW_SEED=true and re-run.\n`;
  throw new Error(reason);
}

async function main() {
  assertSeedAllowed();

  console.log('🌱 بدء تنظيف قاعدة البيانات...');

  // حذف جميع البيانات (ماعدا المستخدمين)
  console.log('⏳ جاري حذف البيانات القديمة...');
  
  await prisma.salesOrderItem.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.salesInvoiceItem.deleteMany();
  await prisma.purchaseInvoiceItem.deleteMany();
  await prisma.productionOrderItem.deleteMany();
  await prisma.bOMItem.deleteMany();
  
  await prisma.salesOrder.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.salesInvoice.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.expense.deleteMany();
  
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  
  await prisma.unit.deleteMany();
  await prisma.itemGroup.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.company.deleteMany();
  
  await prisma.journalEntryLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.account.deleteMany();
  
  console.log('✅ تم حذف جميع البيانات القديمة');
  console.log('\n🎉 قاعدة البيانات الآن نظيفة وفارغة تماماً!');

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
