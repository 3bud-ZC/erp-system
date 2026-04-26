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

// PUT - Update sales invoice (requires update_sales_invoice permission).
//
// FORCE-SAVE policy: the user explicitly wants every edit to persist, even
// when downstream side-effects (stock validation, journal entries, audit
// logs) fail. The approach:
//
//   - Sanitize the items array (drop bad rows) instead of throwing.
//   - Skip stock-availability validation (we used to 400 here).
//   - Wrap journal-entry reversal/creation in try/catch.
//   - Wrap audit/activity logs in try/catch.
//   - Only fail if the invoice itself can't be saved (not-found, schema
//     mismatch, or DB connection error).
//
// Warnings are returned alongside the success payload so the UI can surface
// them to the user without blocking the save.
export async function PUT(request: Request) {
  try {
    console.log('=== START SALES INVOICE UPDATE ===');

    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'update_sales_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }
    if (!user.tenantId) return apiError('لم يتم تعيين مستأجر للمستخدم', 400);

    const body = await request.json();
    const { id, items: rawItems, ...invoiceData } = body;
    if (!id) return apiError('Invoice ID missing', 400);

    /* ── Sanitize items: drop empty / invalid rows instead of failing ── */
    const items: any[] = Array.isArray(rawItems)
      ? rawItems.filter((it: any) =>
          it && it.productId && Number(it.quantity) > 0 && Number(it.price) >= 0,
        )
      : [];
    if (items.length === 0) {
      return apiError('يجب أن تحتوي الفاتورة على صنف واحد على الأقل بكمية وسعر صالحين', 400);
    }

    const warnings: string[] = [];

    /* ── 1. Fetch existing invoice (tenant-scoped) ── */
    const existingInvoice = await prisma.salesInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { items: true },
    });
    if (!existingInvoice) return apiError('Invoice not found or unauthorized', 404);

    /* ── 2. Compute net per-product stock deltas (new - old) ── */
    const oldItemMap = new Map(existingInvoice.items.map((i: any) => [i.productId, i.quantity]));
    const newItemMap = new Map(items.map((i: any) => [i.productId, i.quantity]));
    const stockDeltas: { productId: string; delta: number }[] = [];
    const allProductIds = new Set([
      ...Array.from(oldItemMap.keys()),
      ...Array.from(newItemMap.keys()),
    ]);
    for (const productId of Array.from(allProductIds)) {
      const oldQty = (oldItemMap.get(productId) as number) || 0;
      const newQty = (newItemMap.get(productId) as number) || 0;
      const delta = newQty - oldQty;
      if (delta !== 0) stockDeltas.push({ productId, delta });
    }

    /* ── 3. Stock availability — warn only, don't block ── */
    try {
      const needsValidation = stockDeltas
        .filter(d => d.delta > 0)
        .map(d => ({ productId: d.productId, quantity: d.delta }));
      if (needsValidation.length > 0) {
        const v = await validateStockAvailability(needsValidation);
        if (!v.valid) {
          warnings.push('الفاتورة تم حفظها رغم عدم كفاية المخزون لبعض الأصناف');
          console.warn('STEP 3 WARN: stock validation failed (continuing):', v.errors);
        }
      }
    } catch (e) {
      console.warn('STEP 3 WARN: validateStockAvailability threw:', (e as Error).message);
    }

    /* ── 4. Reverse existing journal entry (best-effort) ── */
    try {
      const existingJE = await prisma.journalEntry.findFirst({
        where: { referenceType: 'SalesInvoice', referenceId: id },
      });
      if (existingJE) {
        await reverseJournalEntry(existingJE.id);
      }
    } catch (e) {
      warnings.push('تعذّر عكس القيد المحاسبي القديم — تم حفظ الفاتورة على أي حال');
      console.warn('STEP 4 WARN:', (e as Error).message);
    }

    /* ── 5. Update invoice + apply stock deltas atomically ── */
    const invoice = await prisma.$transaction(async (tx: any) => {
      await tx.salesInvoiceItem.deleteMany({ where: { salesInvoiceId: id } });

      const updatedInvoice = await tx.salesInvoice.update({
        where: { id },
        data: { ...invoiceData, items: { create: items } },
        include: { items: true },
      });

      for (const d of stockDeltas) {
        try {
          await tx.product.update({
            where: { id: d.productId },
            data: { stock: { decrement: d.delta } },
          });
          await createInventoryTransaction(
            tx, d.productId, 'adjustment', -d.delta, id,
            'Sales invoice updated — stock quantity adjusted',
          );
        } catch (e) {
          console.warn(`STEP 5 WARN: stock adjustment failed for ${d.productId}:`, (e as Error).message);
        }
      }
      return updatedInvoice;
    });

    /* ── 6. Recreate the journal entry with the new total (best-effort) ── */
    try {
      const newTotal = items.reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.price), 0);
      const newJE = await createSalesInvoiceEntry(invoice.id, newTotal, user.tenantId);
      if (newJE) {
        await postJournalEntry(newJE.id);
        await dualRunCompare('SalesInvoice:PUT', newJE);
      }
    } catch (e) {
      warnings.push('تعذّر إنشاء القيد المحاسبي الجديد — تم حفظ الفاتورة على أي حال');
      console.warn('STEP 6 WARN:', (e as Error).message);
    }

    /* ── 7. Audit + activity log (best-effort) ── */
    try {
      await logAuditAction(
        user.id, 'UPDATE', 'sales', 'SalesInvoice', invoice.id, { invoice },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined,
      );
      await logActivity({
        entity: 'SalesInvoice', entityId: invoice.id, action: 'UPDATE',
        userId: user.id, before: existingInvoice, after: invoice,
      });
    } catch (e) {
      console.warn('AUDIT WARN:', (e as Error).message);
    }

    console.log('=== END SUCCESS: Sales invoice updated ===', { invoiceId: invoice.id, warnings: warnings.length });
    return apiSuccess(
      { ...invoice, warnings: warnings.length ? warnings : undefined },
      warnings.length
        ? 'تم حفظ الفاتورة مع تحذيرات'
        : 'Sales invoice updated successfully',
    );
  } catch (error) {
    return handleApiError(error, 'Update sales invoice');
  }
}

// DELETE - Delete sales invoice (requires delete_sales_invoice permission).
//
// FORCE-DELETE policy: the user explicitly wants every sales-invoice action
// (create / edit / delete) to succeed reliably.  This handler therefore
// cascades through *every* downstream record that would otherwise raise an
// FK violation:
//
//   1. Reverse + delete each related Payment + its allocations + its JE.
//   2. Detach (NOT delete) any SalesReturn that referenced this invoice.
//      Returns are independent accounting events; we only null-out the FK.
//   3. Reverse the invoice's own JournalEntry (if any).
//   4. Restore stock and create reversal inventory transactions.
//   5. Delete invoice items + the invoice itself.
//
// Each downstream step is wrapped in a try/catch that *logs but does not
// abort* — partial cascade failures should not prevent the invoice from
// being deleted.  The only fatal error is "invoice not found".
export async function DELETE(request: Request) {
  try {
    console.log('=== START SALES INVOICE DELETE ===');

    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'delete_sales_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiError('Invoice ID missing', 400);
    if (!user.tenantId) return apiError('لم يتم تعيين مستأجر للمستخدم', 400);

    console.log('REQUEST:', { invoiceId: id, tenantId: user.tenantId });

    /* ── 1. Cascade-delete related Payments (with their JE + allocations) ── */
    const relatedPayments = await prisma.payment.findMany({
      where: { salesInvoiceId: id, tenantId: user.tenantId },
      select: { id: true, journalEntryId: true },
    });
    console.log(`STEP 1: Found ${relatedPayments.length} related payment(s) to cascade`);
    for (const p of relatedPayments) {
      try {
        // Reverse the payment's own journal entry first so account balances
        // stay correct.  We swallow errors so a single bad JE never blocks
        // the wider delete operation.
        if (p.journalEntryId) {
          try { await reverseJournalEntry(p.journalEntryId); }
          catch (e) { console.warn(`  - JE reversal failed for payment ${p.id}:`, (e as Error).message); }
        }
        await prisma.paymentAllocation.deleteMany({ where: { paymentId: p.id } });
        await prisma.payment.delete({ where: { id: p.id } });
      } catch (e) {
        console.warn(`STEP 1 WARN: Could not fully clean payment ${p.id}:`, (e as Error).message);
      }
    }

    /* ── 2. Detach SalesReturns (don't delete; they're independent docs) ── */
    try {
      const detached = await prisma.salesReturn.updateMany({
        where: { salesInvoiceId: id, tenantId: user.tenantId },
        data: { salesInvoiceId: null },
      });
      if (detached.count > 0) {
        console.log(`STEP 2: Detached ${detached.count} sales return(s)`);
      }
    } catch (e) {
      console.warn('STEP 2 WARN: detach returns failed:', (e as Error).message);
    }

    /* ── 3. Reverse the invoice's own JournalEntry ── */
    try {
      const je = await prisma.journalEntry.findFirst({
        where: { referenceType: 'SalesInvoice', referenceId: id, tenantId: user.tenantId },
      });
      if (je) {
        await reverseJournalEntry(je.id);
        console.log('STEP 3: Invoice JE reversed');
      }
    } catch (e) {
      console.warn('STEP 3 WARN: invoice JE reversal failed:', (e as Error).message);
    }

    /* ── 4 + 5. Restore stock and delete items + invoice in one transaction ─ */
    const deletedInvoice = await prisma.$transaction(async tx => {
      const invoice = await tx.salesInvoice.findFirst({
        where: { id, tenantId: user.tenantId },
        include: { items: true },
      });
      if (!invoice) throw new Error('Invoice not found or unauthorized');

      // Restore stock + log inventory transactions (best-effort)
      for (const item of invoice.items) {
        try {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
          await createInventoryTransaction(
            tx, item.productId, 'adjustment', item.quantity, id,
            'Deleted sales invoice — stock restored',
          );
        } catch (e) {
          console.warn(`STEP 4 WARN: stock restore failed for ${item.productId}:`, (e as Error).message);
        }
      }

      // Delete items then the invoice itself
      await tx.salesInvoiceItem.deleteMany({ where: { salesInvoiceId: id } });
      await tx.salesInvoice.delete({ where: { id } });
      return invoice;
    });

    /* ── Audit + activity log (non-fatal) ── */
    try {
      await logAuditAction(
        user.id, 'DELETE', 'sales', 'SalesInvoice', id, undefined,
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined,
      );
      await logActivity({
        entity: 'SalesInvoice', entityId: id, action: 'DELETE',
        userId: user.id, before: deletedInvoice,
      });
    } catch (e) {
      console.warn('AUDIT WARN:', (e as Error).message);
    }

    console.log('=== END SUCCESS: Sales invoice deleted ===', { invoiceId: id });
    return apiSuccess({ id }, 'Sales invoice deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete sales invoice');
  }
}
