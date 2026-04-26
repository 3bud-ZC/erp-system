import { prisma } from '@/lib/db';
import { purchaseInvoiceRepo } from '@/lib/repositories/purchase-invoice.repo';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { incrementStockWithTransaction, createInventoryTransaction } from '@/lib/inventory-transactions';
import { createPurchaseInvoiceEntry, postJournalEntry, reverseJournalEntry } from '@/lib/accounting';
import { dualRunCompare } from '@/lib/domain/accounting/dual-run';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { resolveInvoiceNumber } from '@/lib/invoice-numbering';

// Translate backend errors to user-friendly Arabic messages
function translatePurchaseError(error: any): string {
  const msg: string = error?.message || String(error);
  if (msg.includes('Foreign key') || msg.includes('foreign key') || msg.includes('P2003')) return 'هذا العنصر مرتبط ببيانات أخرى';
  if (msg.includes('Unique constraint') || msg.includes('P2002')) return 'رقم الفاتورة مستخدم بالفعل';
  if (msg.includes('Validation') || msg.includes('validation') || msg.includes('P2000')) return 'بيانات غير مكتملة أو غير صحيحة';
  if (msg.includes('Record to update not found') || msg.includes('P2025')) return 'السجل غير موجود';
  return 'حدث خطأ غير متوقع — يرجى المحاولة مرة أخرى';
}

// GET - Read purchase invoices (requires read_purchase_invoice permission)
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
      const invoice = await purchaseInvoiceRepo.findByIdAndTenant(id, user.tenantId);
      if (!invoice) return apiError('الفاتورة غير موجودة', 404);
      return apiSuccess(invoice, 'Purchase invoice fetched successfully');
    }

    const invoices = await purchaseInvoiceRepo.listByTenant(user.tenantId);
    return apiSuccess(invoices, 'Purchase invoices fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch purchase invoices');
  }
}

// POST - Create purchase invoice (requires create_purchase_invoice permission)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_purchase_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
      const { items, tenantId: _clientTenantId, ...invoiceData } = body;

      // Explicit input validation
      if (!invoiceData.supplierId) {
        return apiError('يجب اختيار المورد', 400);
      }
      if (!Array.isArray(items) || items.length === 0) {
        return apiError('يجب إضافة صنف واحد على الأقل', 400);
      }
      for (const item of items) {
        if (!item.productId) return apiError('كل صنف يجب أن يحتوي على منتج محدد', 400);
        if (Number(item.quantity) <= 0) return apiError('الكمية يجب أن تكون أكبر من صفر', 400);
        if (Number(item.price) < 0) return apiError('السعر يجب أن يكون صحيحاً', 400);
      }

      // Calculate total server-side (ignore client-sent total)
      const total = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);

      // Auto-generate invoiceNumber if missing/empty so the form's "(اختياري)"
      // hint matches reality. If the user typed one, we use it as-is.
      const invoiceNumber = await resolveInvoiceNumber(
        invoiceData.invoiceNumber,
        'PI',
        user.tenantId!,
      );

      const invoice = await prisma.$transaction(async (tx) => {
        const newInvoice = await (tx as any).purchaseInvoice.create({
          data: {
            ...invoiceData,
            invoiceNumber,
            tenantId: user.tenantId,   // always from server — never trust client
            total,
            items: {
              create: items.map((item: any) => ({
                ...item,
                total: item.quantity * item.price,
              })),
            },
          },
          include: {
            items: true,
          },
        });

        // Increment stock for all purchased items
        await incrementStockWithTransaction(tx, items, newInvoice.id, 'purchase', user.tenantId || invoiceData.tenantId);

        // Create and post accounting journal entry inside transaction for atomicity
        const journalEntry = await createPurchaseInvoiceEntry(newInvoice.id, total, user.tenantId);
        if (journalEntry) {
          await postJournalEntry(journalEntry.id);
          // Phase 1 dual-run: validate against new domain engine (no behavior change)
          await dualRunCompare('PurchaseInvoice:POST', journalEntry);
        }

        return newInvoice;
      });

      // Log audit action
      await logAuditAction(
        user.id,
        'CREATE',
        'purchases',
        'PurchaseInvoice',
        invoice.id,
        { invoice },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      // Log activity for audit trail
      await logActivity({
        entity: 'PurchaseInvoice',
        entityId: invoice.id,
        action: 'CREATE',
        userId: user.id,
        after: invoice,
      });

      return apiSuccess(invoice, 'Purchase invoice created successfully');
    } catch (error: any) {
      // Server-side: full error logged via handleApiError; client gets translated message
      console.error('[purchase-invoices:POST] failed', error);
      const msg = translatePurchaseError(error);
      return apiError(msg, 500);
    }
  }

// PUT - Update purchase invoice (requires update_purchase_invoice permission).
//
// FORCE-SAVE policy: mirrors the sales-invoice PUT — sanitize bad rows,
// wrap journal-entry/audit side-effects in try/catch, surface warnings
// instead of failing.  See the long comment on sales-invoice PUT.
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'update_purchase_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }
    if (!user.tenantId) return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    const tenantId = user.tenantId; // narrow

    const body = await request.json();
    const { id: bodyId, items: rawItems, ...invoiceData } = body;
    const queryId = new URL(request.url).searchParams.get('id');
    const id = bodyId || queryId;
    if (!id) return apiError('Invoice ID missing', 400);

    /* ── Sanitize items ── */
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
    const existingInvoice = await (prisma as any).purchaseInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { items: true },
    });
    if (!existingInvoice) return apiError('الفاتورة غير موجودة', 404);

    /* ── 2. Compute per-product stock deltas ── */
    const oldItemMap = new Map(existingInvoice.items.map((i: any) => [i.productId, i.quantity]));
    const newItemMap = new Map(items.map((i: any) => [i.productId, i.quantity]));
    const stockDeltas: { productId: string; delta: number }[] = [];
    const allProductIds = new Set([
      ...Array.from(oldItemMap.keys()),
      ...Array.from(newItemMap.keys()),
    ]);
    for (const productId of Array.from(allProductIds)) {
      const oldQty = Number(oldItemMap.get(productId) || 0);
      const newQty = Number(newItemMap.get(productId) || 0);
      const delta = newQty - oldQty;
      if (delta !== 0) stockDeltas.push({ productId: productId as string, delta });
    }

    /* ── 3. Reverse existing journal entry (best-effort) ── */
    try {
      const existingJE = await (prisma as any).journalEntry.findFirst({
        where: { referenceType: 'PurchaseInvoice', referenceId: id },
      });
      if (existingJE) await reverseJournalEntry(existingJE.id);
    } catch (e) {
      warnings.push('تعذّر عكس القيد المحاسبي القديم — تم حفظ الفاتورة على أي حال');
      console.warn('PURCHASE PUT WARN (JE reverse):', (e as Error).message);
    }

    /* ── 4. Update invoice + apply stock deltas atomically ── */
    const invoice = await prisma.$transaction(async tx => {
      await (tx as any).purchaseInvoiceItem.deleteMany({ where: { purchaseInvoiceId: id } });

      const updatedInvoice = await (tx as any).purchaseInvoice.update({
        where: { id },
        data: { ...invoiceData, items: { create: items } },
        include: { items: true },
      });

      for (const d of stockDeltas) {
        try {
          await (tx as any).product.update({
            where: { id: d.productId },
            data: { stock: { increment: d.delta } },
          });
          await createInventoryTransaction(
            tx, d.productId, 'adjustment', d.delta,
            tenantId, id,
            'Purchase invoice updated — stock quantity adjusted',
          );
        } catch (e) {
          console.warn(`PURCHASE PUT WARN (stock ${d.productId}):`, (e as Error).message);
        }
      }
      return updatedInvoice;
    });

    /* ── 5. Recreate journal entry (best-effort) ── */
    try {
      const newTotal = items.reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.price), 0);
      const newJE = await createPurchaseInvoiceEntry(invoice.id, newTotal, user.tenantId);
      if (newJE) {
        await postJournalEntry(newJE.id);
        await dualRunCompare('PurchaseInvoice:PUT', newJE);
      }
    } catch (e) {
      warnings.push('تعذّر إنشاء القيد المحاسبي الجديد — تم حفظ الفاتورة على أي حال');
      console.warn('PURCHASE PUT WARN (JE create):', (e as Error).message);
    }

    /* ── 6. Audit + activity log (best-effort) ── */
    try {
      await logAuditAction(
        user.id, 'UPDATE', 'purchases', 'PurchaseInvoice', invoice.id, { invoice },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined,
      );
      await logActivity({
        entity: 'PurchaseInvoice', entityId: invoice.id, action: 'UPDATE',
        userId: user.id, before: existingInvoice, after: invoice,
      });
    } catch (e) {
      console.warn('PURCHASE PUT AUDIT WARN:', (e as Error).message);
    }

    return apiSuccess(
      { ...invoice, warnings: warnings.length ? warnings : undefined },
      warnings.length ? 'تم حفظ الفاتورة مع تحذيرات' : 'Purchase invoice updated successfully',
    );
  } catch (error) {
    return handleApiError(error, 'Update purchase invoice');
  }
}

// DELETE - Delete purchase invoice (requires delete_purchase_invoice permission).
//
// FORCE-DELETE policy mirrors the sales-invoice handler: cascade-clean every
// downstream record so the user can always remove a purchase invoice.
//
//   1. Reverse + delete each related Payment + its allocations + JE.
//   2. Detach (NOT delete) any PurchaseReturn referencing this invoice.
//   3. Reverse the invoice's own JournalEntry (if any).
//   4. Reverse stock + log adjustment inventory transactions.
//   5. Delete invoice items + the invoice itself.
//
// Each downstream step uses try/catch so partial failures still let the
// invoice be deleted.
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'delete_purchase_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiError('معرف الفاتورة مطلوب', 400);
    if (!user.tenantId) return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    const tenantId = user.tenantId; // narrow

    /* ── 1. Cascade-delete related Payments ── */
    const relatedPayments = await prisma.payment.findMany({
      where: { purchaseInvoiceId: id, tenantId: user.tenantId },
      select: { id: true, journalEntryId: true },
    });
    for (const p of relatedPayments) {
      try {
        if (p.journalEntryId) {
          try { await reverseJournalEntry(p.journalEntryId); }
          catch (e) { console.warn(`  - JE reversal failed for payment ${p.id}:`, (e as Error).message); }
        }
        await prisma.paymentAllocation.deleteMany({ where: { paymentId: p.id } });
        await prisma.payment.delete({ where: { id: p.id } });
      } catch (e) {
        console.warn(`STEP 1 WARN: payment ${p.id} cleanup failed:`, (e as Error).message);
      }
    }

    /* ── 2. Detach PurchaseReturns ── */
    try {
      await prisma.purchaseReturn.updateMany({
        where: { purchaseInvoiceId: id, tenantId: user.tenantId },
        data: { purchaseInvoiceId: null },
      });
    } catch (e) {
      console.warn('STEP 2 WARN: detach returns failed:', (e as Error).message);
    }

    /* ── 3. Reverse the invoice's own JournalEntry ── */
    try {
      const je = await prisma.journalEntry.findFirst({
        where: { referenceType: 'PurchaseInvoice', referenceId: id, tenantId: user.tenantId },
      });
      if (je) await reverseJournalEntry(je.id);
    } catch (e) {
      console.warn('STEP 3 WARN: invoice JE reversal failed:', (e as Error).message);
    }

    /* ── 4. Fetch invoice + items BEFORE the deletion transaction ──
     *
     * Same reasoning as the sales-invoice handler: try/catch around DB
     * calls inside `$transaction` does NOT recover from a failed query
     * (Postgres aborts the whole transaction → 25P02 on every subsequent
     * call).  So stock-reverse and inventory-transaction logging happen
     * outside, each in its own try/catch.                               */
    const invoice = await (prisma as any).purchaseInvoice.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { items: true },
    });
    if (!invoice) return apiError('الفاتورة غير موجودة', 404);

    /* ── 4a. Reverse stock per item (outside the tx) ── */
    for (const item of invoice.items) {
      try {
        await (prisma as any).product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      } catch (e) {
        console.warn(`STEP 4a WARN: stock reverse failed for ${item.productId}:`, (e as Error).message);
      }
      try {
        await createInventoryTransaction(
          prisma, item.productId, 'adjustment', -item.quantity,
          tenantId, id,
          'Deleted purchase invoice — stock reversed',
        );
      } catch (e) {
        console.warn(`STEP 4a WARN: inventory tx log failed for ${item.productId}:`, (e as Error).message);
      }
    }

    /* ── 5. Delete items + invoice (small atomic transaction) ── */
    const deletedInvoice = await prisma.$transaction(async tx => {
      await (tx as any).purchaseInvoiceItem.deleteMany({ where: { purchaseInvoiceId: id } });
      await (tx as any).purchaseInvoice.delete({ where: { id } });
      return invoice;
    });

    try {
      await logAuditAction(
        user.id, 'DELETE', 'purchases', 'PurchaseInvoice', id, undefined,
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined,
      );
      await logActivity({
        entity: 'PurchaseInvoice', entityId: id, action: 'DELETE',
        userId: user.id, before: deletedInvoice,
      });
    } catch (e) {
      console.warn('AUDIT WARN:', (e as Error).message);
    }

    return apiSuccess({ id }, 'Purchase invoice deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete purchase invoice');
  }
}
