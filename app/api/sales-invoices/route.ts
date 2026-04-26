import { prisma } from '@/lib/db';
import { salesInvoiceRepo } from '@/lib/repositories/sales-invoice.repo';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { validateStockAvailability } from '@/lib/inventory';
import { createSalesInvoiceEntry, postJournalEntry, reverseJournalEntry } from '@/lib/accounting';
import { dualRunCompare, dualRunCompareById } from '@/lib/domain/accounting/dual-run';
import { createInventoryTransaction } from '@/lib/inventory-transactions';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { 
  createSalesInvoiceAtomic
} from '@/lib/erp-execution-engine/services/atomic-transaction-service';
import { resolveInvoiceNumber } from '@/lib/invoice-numbering';

// Translate backend errors to user-friendly Arabic messages
function translateSalesError(error: any): string {
  const msg: string = error?.message || String(error);
  if (msg.includes('INVOICE_FAILED')) return 'فشل إنشاء الفاتورة';
  if (msg.includes('INVENTORY_FAILED')) return 'فشل تحديث المخزون';
  if (msg.includes('ACCOUNTING_FAILED')) return 'فشل إنشاء القيود المحاسبية';
  if (msg.includes('VALIDATION_FAILED')) return 'بيانات الفاتورة غير صحيحة';
  if (msg.includes('Foreign key') || msg.includes('foreign key') || msg.includes('P2003')) return 'هذا العنصر مرتبط ببيانات أخرى';
  if (msg.includes('Unique constraint') || msg.includes('P2002')) return 'رقم الفاتورة مستخدم بالفعل';
  if (msg.includes('Stock') || msg.includes('stock') || msg.includes('insufficient')) return 'رصيد المخزون غير كافٍ';
  if (msg.includes('Validation') || msg.includes('validation') || msg.includes('P2000')) return 'بيانات غير مكتملة أو غير صحيحة';
  if (msg.includes('Record to update not found') || msg.includes('P2025')) return 'السجل غير موجود';
  return 'فشل إنشاء الفاتورة — يرجى المحاولة مرة أخرى';
}

// GET - Read sales invoices (requires read_sales_invoice permission)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single invoice by id
    if (id) {
      const invoice = await salesInvoiceRepo.findByIdAndTenant(id, user.tenantId);
      if (!invoice) return apiError('الفاتورة غير موجودة', 404);
      return apiSuccess(invoice, 'Sales invoice fetched successfully');
    }

    const invoices = await salesInvoiceRepo.listByTenant(user.tenantId);
    return apiSuccess(invoices, 'Sales invoices fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch sales invoices');
  }
}

// POST - Create sales invoice (requires create_sales_invoice permission)
export async function POST(request: Request) {
  const requestId = `[SalesInvoice-${Date.now()}]`;
  
  try {
    console.log(`${requestId} ✓ Request started`);
    
    // ========================================================================
    // STEP 1: Authentication & Authorization
    // ========================================================================
    const user = await getAuthenticatedUser(request);
    if (!user) {
      console.log(`${requestId} ✗ Not authenticated`);
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_sales_invoice')) {
      console.log(`${requestId} ✗ No permission for user ${user.id}`);
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    console.log(`${requestId} ✓ Auth passed for user ${user.id}, tenant ${user.tenantId}`);

    // ========================================================================
    // STEP 2: Parse Request Body
    // ========================================================================
    let body;
    try {
      body = await request.json();
      console.log(`${requestId} ✓ Request parsed`, { itemsCount: body.items?.length });
    } catch (parseErr) {
      console.log(`${requestId} ✗ Failed to parse request body`, parseErr);
      return apiError('بيانات الطلب غير صحيحة', 400);
    }

    const { items, ...invoiceData } = body;
    const { tenantId: _clientTenantId, ...safeInvoiceData } = invoiceData;

    // ========================================================================
    // STEP 3: Tenant Validation
    // ========================================================================
    if (!user.tenantId) {
      console.log(`${requestId} ✗ No tenant assigned to user`);
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    // ========================================================================
    // STEP 4: Input Validation (Strict)
    // ========================================================================
    console.log(`${requestId} → Validating inputs...`);
    
    if (!safeInvoiceData.customerId) {
      console.log(`${requestId} ✗ Validation failed: no customerId`);
      return apiError('يجب اختيار العميل', 400);
    }

    if (!Array.isArray(items) || items.length === 0) {
      console.log(`${requestId} ✗ Validation failed: items not array or empty`);
      return apiError('يجب إضافة صنف واحد على الأقل', 400);
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        console.log(`${requestId} ✗ Validation failed: item ${i} missing productId`);
        return apiError('كل صنف يجب أن يحتوي على منتج محدد', 400);
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        console.log(`${requestId} ✗ Validation failed: item ${i} invalid quantity`, item.quantity);
        return apiError('الكمية يجب أن تكون أكبر من صفر', 400);
      }
      if (item.price == null || Number(item.price) < 0) {
        console.log(`${requestId} ✗ Validation failed: item ${i} invalid price`, item.price);
        return apiError('السعر يجب أن يكون صحيحاً', 400);
      }
    }

    console.log(`${requestId} ✓ All inputs valid`);

    // ========================================================================
    // STEP 5: Verify Customer Exists in Tenant
    // ========================================================================
    console.log(`${requestId} → Checking customer exists...`);
    let customerExists = false;
    try {
      const customer = await (prisma as any).customer.findFirst({
        where: { id: safeInvoiceData.customerId, tenantId: user.tenantId },
        select: { id: true },
      });
      customerExists = !!customer;
      if (!customerExists) {
        console.log(`${requestId} ✗ Customer ${safeInvoiceData.customerId} not found`);
        return apiError('العميل المختار غير موجود', 404);
      }
      console.log(`${requestId} ✓ Customer verified`);
    } catch (custErr) {
      console.log(`${requestId} ✗ Error verifying customer`, custErr);
      return apiError('خطأ في التحقق من العميل', 500);
    }

    // ========================================================================
    // STEP 6: Stock Availability Check
    // ========================================================================
    console.log(`${requestId} → Checking stock availability...`);
    let validation;
    try {
      validation = await validateStockAvailability(items);
      if (!validation.valid) {
        console.log(`${requestId} ✗ Stock check failed`, validation.errors);
        return apiError(
          'رصيد المخزون غير كافٍ لأحد المنتجات أو أكثر',
          400,
          { details: validation.errors }
        );
      }
      console.log(`${requestId} ✓ Stock available`);
    } catch (stockErr) {
      console.log(`${requestId} ✗ Stock validation error`, stockErr);
      return apiError('خطأ في التحقق من المخزون', 500);
    }

    // ========================================================================
    // STEP 7: Create Invoice Atomically
    // ========================================================================
    console.log(`${requestId} → Creating invoice atomically...`);
    let invoice;
    try {
      // Resolve a clean, sequential, per-tenant invoice number (INV-YYYY-NNNNNN).
      // If the user typed a custom number, we keep it.
      const invoiceNumber = await resolveInvoiceNumber(
        safeInvoiceData.invoiceNumber,
        'INV',
        user.tenantId,
      );

      const result = await createSalesInvoiceAtomic({
        invoiceData: {
          ...safeInvoiceData,
          invoiceNumber,
          date: safeInvoiceData.date ? new Date(safeInvoiceData.date) : new Date(),
        },
        items,
        tenantId: user.tenantId,
        userId: user.id,
      });
      invoice = result.invoice;
      console.log(`${requestId} ✓ Invoice created: ${invoice.id}`);
      // Phase 1 dual-run: validate atomic-service journal entry against new domain engine
      await dualRunCompareById('SalesInvoice:POST', (result as any)?.journalEntry?.id);
    } catch (txnErr: any) {
      console.error(`${requestId} ✗ Invoice creation transaction failed:`, txnErr);
      const txnMsg = translateSalesError(txnErr);
      return apiError(txnMsg || 'فشل إنشاء الفاتورة', 500);
    }

    // ========================================================================
    // STEP 8: Log Audit (Non-Critical)
    // ========================================================================
    console.log(`${requestId} → Logging audit action...`);
    try {
      await logAuditAction(
        user.id,
        'CREATE',
        'sales',
        'SalesInvoice',
        invoice.id,
        { invoice },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );
      console.log(`${requestId} ✓ Audit logged`);
    } catch (auditErr) {
      console.error(`${requestId} ! Audit logging failed (non-critical):`, auditErr);
      // Do NOT fail if audit fails
    }

    // ========================================================================
    // STEP 9: Log Activity (Non-Critical)
    // ========================================================================
    console.log(`${requestId} → Logging activity...`);
    try {
      await logActivity({
        entity: 'SalesInvoice',
        entityId: invoice.id,
        action: 'CREATE',
        userId: user.id,
        after: invoice,
      });
      console.log(`${requestId} ✓ Activity logged`);
    } catch (actErr) {
      console.error(`${requestId} ! Activity logging failed (non-critical):`, actErr);
      // Do NOT fail if activity fails
    }

    console.log(`${requestId} ✓✓✓ SUCCESS - Invoice saved with ID: ${invoice.id}`);
    return apiSuccess(invoice, 'تم حفظ الفاتورة بنجاح');
    
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error(`[SalesInvoice-ERROR] Unexpected error in POST:`, msg);
    const translatedMsg = translateSalesError(error);
    return apiError(translatedMsg || 'فشل إنشاء الفاتورة', 500);
  }
}

// PUT - Update sales invoice (requires update_sales_invoice permission)
export async function PUT(request: Request) {
  try {
    console.log("=== START SALES INVOICE UPDATE ===");
    
    const user = await getAuthenticatedUser(request);
    if (!user) {
      console.error("ERROR: User not authenticated");
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_sales_invoice')) {
      console.error("ERROR: User lacks permission");
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const { id, items, ...invoiceData } = body;
    
    console.log("REQUEST DATA:", {
      invoiceId: id,
      tenantId: user.tenantId,
      itemCount: items?.length,
      body: JSON.stringify(body).substring(0, 200)
    });

    if (!id) {
      console.error("ERROR: Invoice ID missing");
      throw new Error("Invoice ID missing");
    }

    if (!items || items.length === 0) {
      console.error("ERROR: Items array empty");
      throw new Error("Items cannot be empty");
    }

    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        console.error("ERROR: Invalid quantity", item);
        throw new Error("Quantity must be greater than 0");
      }
      if (item.price < 0) {
        console.error("ERROR: Invalid price", item);
        throw new Error("Price cannot be negative");
      }
    }

    if (!user.tenantId) {
      console.error("ERROR: Tenant ID missing");
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

      // STEP 1: Fetch existing invoice (scoped to tenant)
      console.log("STEP 1: Fetching existing invoice...");
      const existingInvoice = await prisma.salesInvoice.findFirst({
        where: { id, tenantId: user.tenantId },
        include: { items: true },
      });

      if (!existingInvoice) {
        console.error("ERROR: Invoice not found or unauthorized");
        throw new Error("Invoice not found or unauthorized");
      }
      
      console.log("STEP 1 SUCCESS: Invoice found", {
        invoiceId: existingInvoice.id,
        oldItemCount: existingInvoice.items.length
      });

      // STEP 2: Calculate net stock effect by comparing old vs new items
      console.log("STEP 2: Calculating stock deltas...");
      const oldItemMap = new Map(existingInvoice.items.map((i: any) => [i.productId, i.quantity]));
      const newItemMap = new Map(items.map((i: any) => [i.productId, i.quantity]));

      const stockDeltas: { productId: string; delta: number }[] = [];
      const allProductIds = new Set([...Array.from(oldItemMap.keys()), ...Array.from(newItemMap.keys())]);

      for (const productId of Array.from(allProductIds)) {
        const oldQty = oldItemMap.get(productId) || 0;
        const newQty = newItemMap.get(productId) || 0;
        const delta = (newQty as number) - (oldQty as number);
        if (delta !== 0) {
          stockDeltas.push({ productId, delta });
        }
      }
      
      console.log("STEP 2 SUCCESS: Stock deltas calculated", { deltaCount: stockDeltas.length });

      // STEP 3: Validate stock for any increases in quantity
      console.log("STEP 3: Validating stock availability...");
      const itemsNeedingValidation = stockDeltas
        .filter((d) => d.delta > 0)
        .map((d) => ({ productId: d.productId, quantity: d.delta }));

      if (itemsNeedingValidation.length > 0) {
        const updateValidation = await validateStockAvailability(itemsNeedingValidation);
        if (!updateValidation.valid) {
          console.error("ERROR: Stock validation failed", updateValidation.errors);
          return apiError(
            'رصيد المخزون غير كافٍ للكميات المحدّثة',
            400,
            { details: updateValidation.errors }
          );
        }
      }
      
      console.log("STEP 3 SUCCESS: Stock validation passed");

      // STEP 3b: Reverse existing journal entry (prevents stale accounting records)
      console.log("STEP 3b: Reversing journal entry...");
      const existingJournalEntry = await prisma.journalEntry.findFirst({
        where: { referenceType: 'SalesInvoice', referenceId: id },
      });
      if (existingJournalEntry) {
        await reverseJournalEntry(existingJournalEntry.id);
        console.log("STEP 3b SUCCESS: Journal entry reversed");
      } else {
        console.log("STEP 3b SKIP: No journal entry to reverse");
      }

      // STEP 4: Execute update atomically with stock delta adjustments
      console.log("STEP 4: Starting transaction...");
      const invoice = await (prisma as any).$transaction(async (tx: any) => {
        console.log('STEP 4a: Deleting old items...');
        try {
          await tx.salesInvoiceItem.deleteMany({
            where: { salesInvoiceId: id },
          });
          console.log('STEP 4a SUCCESS: Old items deleted');
        } catch (e: any) {
          console.error('STEP 4a ERROR: Failed to delete items', e.message);
          throw e;
        }

        console.log('STEP 4b: Updating invoice with new items...');
        const updatedInvoice = await tx.salesInvoice.update({
          where: { id },
          data: {
            ...invoiceData,
            items: {
              create: items,
            },
          },
          include: {
            items: true,
          },
        });
        console.log('STEP 4b SUCCESS: Invoice updated with new items');

        // Apply net stock delta adjustments for changed quantities
        console.log('STEP 4c: Applying stock adjustments...', { deltaCount: stockDeltas.length });
        for (const delta of stockDeltas) {
          await tx.product.update({
            where: { id: delta.productId },
            data: { stock: { decrement: delta.delta } },
          });
          await createInventoryTransaction(
            tx,
            delta.productId,
            'adjustment',
            -delta.delta,
            id,
            'Sales invoice updated — stock quantity adjusted'
          );
          
          const product = await tx.product.findUnique({ where: { id: delta.productId } });
          if (product && product.stock < 0) {
            console.error('CRITICAL: NEGATIVE STOCK DETECTED', { productId: delta.productId, stock: product.stock });
            throw new Error(`NEGATIVE STOCK DETECTED for product ${delta.productId}`);
          }
        }
        console.log('STEP 4c SUCCESS: Stock adjustments applied');

        return updatedInvoice;
      });
      
      console.log('STEP 4 SUCCESS: Transaction completed');

      // STEP 5: Create and post new journal entry with updated total
      console.log('STEP 5: Creating journal entry...');
      const newTotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
      const newJournalEntry = await createSalesInvoiceEntry(invoice.id, newTotal, user.tenantId);
      if (newJournalEntry) {
        await postJournalEntry(newJournalEntry.id);
        // Phase 1 dual-run: validate against new domain engine (no behavior change)
        await dualRunCompare('SalesInvoice:PUT', newJournalEntry);
        console.log('STEP 5 SUCCESS: Journal entry created and posted');
      } else {
        console.log('STEP 5 SKIP: Journal entry creation skipped');
      }

      // Log audit action
      await logAuditAction(
        user.id,
        'UPDATE',
        'sales',
        'SalesInvoice',
        invoice.id,
        { invoice },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      console.log("=== END SUCCESS: Sales invoice updated ===", { invoiceId: invoice.id });
      
      // Log activity for audit trail
      await logActivity({
        entity: 'SalesInvoice',
        entityId: invoice.id,
        action: 'UPDATE',
        userId: user.id,
        before: existingInvoice,
        after: invoice,
      });

      return apiSuccess(invoice, 'Sales invoice updated successfully');
    } catch (error) {
      return handleApiError(error, 'Update sales invoice');
    }
  }

// DELETE - Delete sales invoice (requires delete_sales_invoice permission)
export async function DELETE(request: Request) {
  try {
    console.log("=== START SALES INVOICE DELETE ===");
    
    const user = await getAuthenticatedUser(request);
    if (!user) {
      console.error("ERROR: User not authenticated");
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_sales_invoice')) {
      console.error("ERROR: User lacks permission");
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    console.log("REQUEST DATA:", { invoiceId: id, tenantId: user.tenantId });
    
    if (!id) {
      console.error("ERROR: Invoice ID missing");
      throw new Error("Invoice ID missing");
    }

    // STEP 1: Reverse journal entry to restore account balances
    console.log("STEP 1: Reversing journal entry...");
      const existingJournalEntry = await prisma.journalEntry.findFirst({
        where: { referenceType: 'SalesInvoice', referenceId: id, tenantId: user.tenantId },
      });
      if (existingJournalEntry) {
        await reverseJournalEntry(existingJournalEntry.id);
        console.log("STEP 1 SUCCESS: Journal entry reversed");
      } else {
        console.log("STEP 1 SKIP: No journal entry to reverse");
      }

      // STEP 2: Delete invoice and reverse stock in transaction
      console.log("STEP 2: Starting transaction...");
      const deletedInvoice = await prisma.$transaction(async (tx) => {
        console.log("STEP 2a: Fetching invoice...");
        const invoice = await tx.salesInvoice.findFirst({
          where: { id, tenantId: user.tenantId },
          include: { items: true },
        });

        if (!invoice) {
          console.error("ERROR: Invoice not found or unauthorized");
          throw new Error('Invoice not found or unauthorized');
        }
        
        console.log("STEP 2a SUCCESS: Invoice found", { itemCount: invoice.items.length });

        // Reverse stock: return the quantities that were deducted by this invoice
        console.log("STEP 2b: Restoring stock...");
        for (const item of invoice.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
          await createInventoryTransaction(
            tx,
            item.productId,
            'adjustment',
            item.quantity,
            id,
            'Deleted sales invoice — stock restored'
          );
        }
        console.log("STEP 2b SUCCESS: Stock restored");

        // Delete items first to avoid foreign key constraints
        console.log('STEP 2c: Deleting items...');
        try {
          await tx.salesInvoiceItem.deleteMany({
            where: { salesInvoiceId: id },
          });
          console.log('STEP 2c SUCCESS: Items deleted');
        } catch (e: any) {
          console.error('STEP 2c ERROR: Failed to delete items', e.message);
          throw e;
        }

        console.log('STEP 2d: Deleting invoice...');
        // Tenant ownership already verified by findFirst above (line ~523).
        // Prisma .delete() requires a single unique field — adding tenantId
        // here makes Prisma demand a compound unique [id,tenantId] which the
        // schema does not declare, throwing "Unknown argument tenantId".
        await tx.salesInvoice.delete({
          where: { id },
        });
        console.log('STEP 2d SUCCESS: Invoice deleted');

        return invoice;
      });
      
      console.log("STEP 2 SUCCESS: Transaction completed");

      // Log audit action
      await logAuditAction(
        user.id,
        'DELETE',
        'sales',
        'SalesInvoice',
        id,
        undefined,
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      console.log("=== END SUCCESS: Sales invoice deleted ===", { invoiceId: id });

      // Log activity for audit trail
      await logActivity({
        entity: 'SalesInvoice',
        entityId: id,
        action: 'DELETE',
        userId: user.id,
        before: deletedInvoice,
      });

      return apiSuccess({ id }, 'Sales invoice deleted successfully');
    } catch (error) {
      return handleApiError(error, 'Delete sales invoice');
    }
  }
