import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// 🛡️  PRODUCTION SAFETY GUARD — same policy as prisma/seed.ts
// ============================================================================
function assertSeedAllowed(): void {
  const isDev = process.env.NODE_ENV === 'development';
  const explicit = process.env.ALLOW_SEED === 'true';
  if (isDev || explicit) return;
  throw new Error(
    `❌ Database wipe is disabled in this environment. ` +
      `Set NODE_ENV=development or ALLOW_SEED=true to allow it.`
  );
}

async function main() {
  assertSeedAllowed();

  console.log('🧹 بدء تنظيف قاعدة البيانات...');

  // حذف جميع البيانات بالترتيب الصحيح (من الأسفل للأعلى)
  console.log('⏳ جاري حذف البيانات...');

  // حذف العناصر الفرعية أولاً
  await prisma.salesOrderItem.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.salesInvoiceItem.deleteMany();
  await prisma.purchaseInvoiceItem.deleteMany();
  await prisma.productionOrderItem.deleteMany();
  await prisma.bOMItem.deleteMany();
  
  console.log('✅ تم حذف عناصر الفواتير والأوامر');

  // حذف الفواتير والأوامر
  await prisma.salesOrder.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.salesInvoice.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.expense.deleteMany();
  
  console.log('✅ تم حذف الفواتير والأوامر والمصروفات');

  // حذف المنتجات والعملاء والموردين
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  
  console.log('✅ تم حذف المنتجات والعملاء والموردين');

  // حذف البيانات الأساسية
  await prisma.unit.deleteMany();
  await prisma.itemGroup.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.company.deleteMany();
  
  console.log('✅ تم حذف البيانات الأساسية');

  // حذف بيانات المحاسبة
  await prisma.journalEntryLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.account.deleteMany();
  
  console.log('✅ تم حذف بيانات المحاسبة');

  console.log('\n🎉 تم تنظيف قاعدة البيانات بنجاح!');
  console.log('✨ قاعدة البيانات الآن فارغة ونظيفة تماماً');
  console.log('\n⚠️ ملاحظة: بيانات المستخدمين (Users) لم يتم حذفها للحفاظ على حسابات الدخول');
}

main()
  .catch((e) => {
    console.error('❌ خطأ في تنظيف البيانات:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
