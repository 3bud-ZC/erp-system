import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 🛡️  PRODUCTION SAFETY GUARD — same policy as prisma/seed.ts
function assertResetAllowed(): void {
  const isDev = process.env.NODE_ENV === 'development';
  const explicit = process.env.ALLOW_SEED === 'true';
  if (isDev || explicit) return;
  throw new Error(
    `❌ Database reset is disabled in this environment. ` +
      `Set NODE_ENV=development or ALLOW_SEED=true to allow it.`
  );
}

async function main() {
  assertResetAllowed();

  console.log('🧹 بدء إعادة تعيين قاعدة البيانات إلى حالة نظيفة...\n');

  try {
    // ========================================
    // STEP 1: Delete Transaction Details (Child Records)
    // ========================================
    console.log('⏳ حذف تفاصيل المعاملات...');
    
    await prisma.$transaction([
      // Invoice Items
      prisma.salesInvoiceItem.deleteMany(),
      prisma.purchaseInvoiceItem.deleteMany(),
      prisma.salesOrderItem.deleteMany(),
      prisma.purchaseOrderItem.deleteMany(),
      prisma.quotationItem.deleteMany(),
      prisma.salesReturnItem.deleteMany(),
      prisma.purchaseReturnItem.deleteMany(),
      prisma.purchaseRequisitionItem.deleteMany(),
      
      // Journal Entry Lines
      prisma.journalEntryLine.deleteMany(),
      
      // Production Items
      prisma.productionOrderItem.deleteMany(),
      prisma.bOMItem.deleteMany(),
      prisma.goodsReceiptItem.deleteMany(),
      prisma.stocktakeItem.deleteMany(),
      
      // Payment Allocations
      prisma.paymentAllocation.deleteMany(),
    ]);
    
    console.log('✅ تم حذف تفاصيل المعاملات\n');

    // ========================================
    // STEP 2: Delete Transactions (Parent Records)
    // ========================================
    console.log('⏳ حذف المعاملات الرئيسية...');
    
    await prisma.$transaction([
      // Sales & Purchase Documents
      prisma.salesInvoice.deleteMany(),
      prisma.purchaseInvoice.deleteMany(),
      prisma.salesOrder.deleteMany(),
      prisma.purchaseOrder.deleteMany(),
      prisma.quotation.deleteMany(),
      prisma.salesReturn.deleteMany(),
      prisma.purchaseReturn.deleteMany(),
      prisma.purchaseRequisition.deleteMany(),
      
      // Payments
      prisma.payment.deleteMany(),
      
      // Journal Entries
      prisma.journalEntry.deleteMany(),
      
      // Inventory Transactions
      prisma.inventoryTransaction.deleteMany(),
      prisma.stockAdjustment.deleteMany(),
      prisma.stockTransfer.deleteMany(),
      prisma.stockReservation.deleteMany(),
      prisma.stocktake.deleteMany(),
      
      // Production
      prisma.productionOrder.deleteMany(),
      prisma.productionWaste.deleteMany(),
      prisma.workInProgress.deleteMany(),
      prisma.goodsReceipt.deleteMany(),
      prisma.productionLineAssignment.deleteMany(),
      
      // Expenses
      prisma.expense.deleteMany(),
      
      // Accounting
      prisma.inventoryValuation.deleteMany(),
      prisma.cOGSTransaction.deleteMany(),
      prisma.costLayer.deleteMany(),
      prisma.fIFOLayer.deleteMany(),
      prisma.accrual.deleteMany(),
      
      // Batches
      prisma.batch.deleteMany(),
      
      // Outbox Events
      prisma.outboxEvent.deleteMany(),
      
      // Audit Logs
      prisma.auditLog.deleteMany(),
    ]);
    
    console.log('✅ تم حذف المعاملات الرئيسية\n');

    // ========================================
    // STEP 3: Delete Master Data
    // ========================================
    console.log('⏳ حذف البيانات الأساسية...');
    
    await prisma.$transaction([
      // Products & Related
      prisma.product.deleteMany(),
      
      // Customers & Suppliers
      prisma.customer.deleteMany(),
      prisma.supplier.deleteMany(),
      
      // Accounting
      prisma.account.deleteMany(),
      
      // Production Lines
      prisma.productionLine.deleteMany(),
      
      // Fixed Assets & Budgets
      prisma.fixedAsset.deleteMany(),
      prisma.budget.deleteMany(),
      
      // Warehouses & Companies
      prisma.warehouse.deleteMany(),
      prisma.company.deleteMany(),
      
      // Accounting Periods & Fiscal Years
      prisma.accountingPeriod.deleteMany(),
      prisma.fiscalYear.deleteMany(),
    ]);
    
    console.log('✅ تم حذف البيانات الأساسية\n');

    // ========================================
    // STEP 4: Report Summary
    // ========================================
    console.log('═══════════════════════════════════════');
    console.log('🎉 تم إعادة تعيين قاعدة البيانات بنجاح!');
    console.log('═══════════════════════════════════════\n');
    
    console.log('✅ تم الاحتفاظ بـ:');
    console.log('   - هيكل قاعدة البيانات (Schema)');
    console.log('   - المستخدمين والصلاحيات');
    console.log('   - إعدادات المستأجرين (Tenants)');
    console.log('   - الوحدات والمجموعات المرجعية\n');
    
    console.log('✅ تم حذف:');
    console.log('   - جميع الفواتير والمعاملات');
    console.log('   - العملاء والموردين');
    console.log('   - المنتجات والمخزون');
    console.log('   - القيود المحاسبية');
    console.log('   - البيانات التجريبية\n');
    
    console.log('⚠️  النظام الآن جاهز للاستخدام الإنتاجي!');
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ خطأ في إعادة التعيين:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ فشل في إعادة تعيين قاعدة البيانات:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
