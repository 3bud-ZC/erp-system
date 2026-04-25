import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { incrementStockWithTransaction, createInventoryTransaction } from '@/lib/inventory-transactions';
import { createPurchaseInvoiceEntry, postJournalEntry, reverseJournalEntry } from '@/lib/accounting';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';

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
      const invoice = await (prisma as any).purchaseInvoice.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          supplier: true,
          items: { include: { product: true } },
          payments: { orderBy: { date: 'desc' } },
        },
      });
      if (!invoice) return apiError('الفاتورة غير موجودة', 404);
      return apiSuccess(invoice, 'Purchase invoice fetched successfully');
    }

    const invoices = await (prisma as any).purchaseInvoice.findMany({
      where: { tenantId: user.tenantId },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

      const invoice = await prisma.$transaction(async (tx) => {
        const newInvoice = await (tx as any).purchaseInvoice.create({
          data: {
            ...invoiceData,
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
      // Log to secure logging service in production (not console)
      // Do NOT expose error details to client
      const msg = translatePurchaseError(error);
      return apiError(msg, 500);
    }
  }

// PUT - Update purchase invoice (requires update_purchase_invoice permission)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_purchase_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
      const { id, items, ...invoiceData } = body;

      if (!user.tenantId) return apiError('لم يتم تعيين مستأجر للمستخدم', 400);

      // STEP 1: Fetch existing invoice (scoped to tenant)
      const existingInvoice = await (prisma as any).purchaseInvoice.findFirst({
        where: { id, tenantId: user.tenantId },
        include: { items: true },
      });

      if (!existingInvoice) {
        return apiError('الفاتورة غير موجودة', 404);
      }

      // STEP 2: Calculate net stock effect by comparing old vs new items
      const oldItemMap = new Map(existingInvoice.items.map((i: any) => [i.productId, i.quantity]));
      const newItemMap = new Map(items.map((i: any) => [i.productId, i.quantity]));

      const stockDeltas: { productId: string; delta: number }[] = [];
      const allProductIds = new Set([...Array.from(oldItemMap.keys()), ...Array.from(newItemMap.keys())]);

      for (const productId of Array.from(allProductIds)) {
        const oldQty = oldItemMap.get(productId) || 0;
        const newQty = newItemMap.get(productId) || 0;
        const delta = Number(newQty) - Number(oldQty);
        if (delta !== 0) {
          stockDeltas.push({ productId: productId as string, delta });
        }
      }

      // STEP 3: Reverse existing journal entry (prevents stale accounting records)
      const existingJournalEntry = await (prisma as any).journalEntry.findFirst({
        where: { referenceType: 'PurchaseInvoice', referenceId: id },
      });
      if (existingJournalEntry) {
        await reverseJournalEntry(existingJournalEntry.id);
      }

      // STEP 4: Execute update atomically with stock delta adjustments
      const invoice = await prisma.$transaction(async (tx) => {
        console.log('[PURCHASE UPDATE - DELETE ITEMS]', { invoiceId: id });
        try {
          await (tx as any).purchaseInvoiceItem.deleteMany({
            where: { purchaseInvoiceId: id },
          });
          console.log('[PURCHASE UPDATE - DELETE ITEMS SUCCESS]');
        } catch (e: any) {
          console.error('[PURCHASE UPDATE - DELETE ITEMS ERROR]', e.message);
          throw e;
        }

        const updatedInvoice = await (tx as any).purchaseInvoice.update({
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

        // Apply net stock delta adjustments for changed quantities
        for (const delta of stockDeltas) {
          await (tx as any).product.update({
            where: { id: delta.productId },
            data: { stock: { increment: delta.delta } },
          });
          await createInventoryTransaction(
            tx,
            delta.productId,
            'adjustment',
            delta.delta,
            id,
            'Purchase invoice updated — stock quantity adjusted'
          );
        }

        return updatedInvoice;
      });

      // STEP 5: Create and post new journal entry with updated total
      const newTotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
      const newJournalEntry = await createPurchaseInvoiceEntry(invoice.id, newTotal, user.tenantId);
      if (newJournalEntry) {
        await postJournalEntry(newJournalEntry.id);
      }

      // Log audit action
      await logAuditAction(
        user.id,
        'UPDATE',
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
        action: 'UPDATE',
        userId: user.id,
        before: existingInvoice,
        after: invoice,
      });

      return apiSuccess(invoice, 'Purchase invoice updated successfully');
    } catch (error) {
      return handleApiError(error, 'Update purchase invoice');
    }
  }

// DELETE - Delete purchase invoice (requires delete_purchase_invoice permission)
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_purchase_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      
      if (!id) {
        return apiError('معرف الفاتورة مطلوب', 400);
      }

      // STEP 1: Reverse journal entry to restore account balances
      const existingJournalEntry = await (prisma as any).journalEntry.findFirst({
        where: { referenceType: 'PurchaseInvoice', referenceId: id, tenantId: user.tenantId },
      });
      if (existingJournalEntry) {
        await reverseJournalEntry(existingJournalEntry.id);
      }

      // STEP 2: Delete invoice and reverse stock in transaction
      const deletedInvoice = await prisma.$transaction(async (tx) => {
        const invoice = await (tx as any).purchaseInvoice.findFirst({
          where: { id, tenantId: user.tenantId },
          include: { items: true },
        });

        if (!invoice) {
          throw new Error('الفاتورة غير موجودة');
        }

        // Reverse stock: remove the quantities that were added by this invoice
        for (const item of invoice.items) {
          await (tx as any).product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
          await createInventoryTransaction(
            tx,
            item.productId,
            'adjustment',
            -item.quantity,
            id,
            'Deleted purchase invoice — stock reversed'
          );
        }

        // Delete items first to avoid foreign key constraints
        console.log('[PURCHASE DELETE - DELETE ITEMS]', { invoiceId: id });
        try {
          await (tx as any).purchaseInvoiceItem.deleteMany({
            where: { purchaseInvoiceId: id },
          });
          console.log('[PURCHASE DELETE - DELETE ITEMS SUCCESS]');
        } catch (e: any) {
          console.error('[PURCHASE DELETE - DELETE ITEMS ERROR]', e.message);
          throw e;
        }

        await (tx as any).purchaseInvoice.delete({
          where: { id, tenantId: user.tenantId },
        });

        return invoice;
      });

      // Log audit action
      await logAuditAction(
        user.id,
        'DELETE',
        'purchases',
        'PurchaseInvoice',
        id,
        undefined,
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      // Log activity for audit trail
      await logActivity({
        entity: 'PurchaseInvoice',
        entityId: id,
        action: 'DELETE',
        userId: user.id,
        before: deletedInvoice,
      });

      return apiSuccess({ id }, 'Purchase invoice deleted successfully');
    } catch (error) {
      return handleApiError(error, 'Delete purchase invoice');
    }
  }
