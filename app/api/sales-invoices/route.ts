import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { validateStockAvailability } from '@/lib/inventory';
import { createSalesInvoiceEntry, postJournalEntry, reverseJournalEntry } from '@/lib/accounting';
import { createInventoryTransaction } from '@/lib/inventory-transactions';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';
import { 
  createSalesInvoiceAtomic, 
  TransactionError,
  handleTransactionError 
} from '@/lib/erp-execution-engine/services/atomic-transaction-service';

// Translate backend errors to user-friendly Arabic messages
function translateSalesError(error: any): string {
  const msg: string = error?.message || String(error);
  if (msg.includes('Foreign key') || msg.includes('foreign key') || msg.includes('P2003')) return 'هذا العنصر مرتبط ببيانات أخرى';
  if (msg.includes('Unique constraint') || msg.includes('P2002')) return 'رقم الفاتورة مستخدم بالفعل';
  if (msg.includes('Stock') || msg.includes('stock') || msg.includes('insufficient')) return 'رصيد المخزون غير كافٍ';
  if (msg.includes('Validation') || msg.includes('validation') || msg.includes('P2000')) return 'بيانات غير مكتملة أو غير صحيحة';
  if (msg.includes('Record to update not found') || msg.includes('P2025')) return 'السجل غير موجود';
  return 'حدث خطأ غير متوقع — يرجى المحاولة مرة أخرى';
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
      const invoice = await (prisma as any).salesInvoice.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          customer: true,
          items: { include: { product: true } },
          payments: { orderBy: { date: 'desc' } },
        },
      });
      if (!invoice) return apiError('الفاتورة غير موجودة', 404);
      return apiSuccess(invoice, 'Sales invoice fetched successfully');
    }

    const invoices = await (prisma as any).salesInvoice.findMany({
      where: { tenantId: user.tenantId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return apiSuccess(invoices, 'Sales invoices fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch sales invoices');
  }
}

// POST - Create sales invoice (requires create_sales_invoice permission)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_sales_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
      const { items, ...invoiceData } = body;

      // Ensure tenantId comes from user context, not request body
      const { tenantId, ...safeInvoiceData } = invoiceData;

      if (!user.tenantId) {
        return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
      }

      // Explicit input validation
      if (!safeInvoiceData.customerId) {
        return apiError('يجب اختيار العميل', 400);
      }
      if (!Array.isArray(items) || items.length === 0) {
        return apiError('يجب إضافة صنف واحد على الأقل', 400);
      }
      for (const item of items) {
        if (!item.productId) return apiError('كل صنف يجب أن يحتوي على منتج محدد', 400);
        if (!(Number(item.quantity) > 0)) return apiError('الكمية يجب أن تكون أكبر من صفر', 400);
        if (Number(item.price) < 0) return apiError('السعر يجب أن يكون صحيحاً', 400);
      }

      // STEP 1: Quick pre-check for early user-friendly error (outside transaction)
      const validation = await validateStockAvailability(items);
      if (!validation.valid) {
        return apiError(
          'رصيد المخزون غير كافٍ لأحد المنتجات أو أكثر',
          400,
          { details: validation.errors }
        );
      }

      // STEP 2: Create invoice + update inventory + create journal entry ATOMICALLY
      // All operations succeed or all rollback - NO partial writes allowed
      const { invoice, journalEntry } = await createSalesInvoiceAtomic({
        invoiceData: {
          ...safeInvoiceData,
          invoiceNumber: safeInvoiceData.invoiceNumber || `INV-${Date.now()}`,
        },
        items,
        tenantId: user.tenantId,
        userId: user.id,
      });

      // Log audit action
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

      // Log activity for audit trail
      await logActivity({
        entity: 'SalesInvoice',
        entityId: invoice.id,
        action: 'CREATE',
        userId: user.id,
        after: invoice,
      });

      return apiSuccess(invoice, 'Sales invoice created successfully');
    } catch (error: any) {
      console.error('Sales invoice creation error:', error?.message || error);
      // Translate known DB/service errors to Arabic
      const msg = translateSalesError(error);
      return apiError(msg, 500);
    }
  }

// PUT - Update sales invoice (requires update_sales_invoice permission)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_sales_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
      const { id, items, ...invoiceData } = body;

      if (!user.tenantId) return apiError('لم يتم تعيين مستأجر للمستخدم', 400);

      // STEP 1: Fetch existing invoice (scoped to tenant)
      const existingInvoice = await prisma.salesInvoice.findFirst({
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
        const delta = (newQty as number) - (oldQty as number);
        if (delta !== 0) {
          stockDeltas.push({ productId, delta });
        }
      }

      // STEP 3: Validate stock for any increases in quantity
      const itemsNeedingValidation = stockDeltas
        .filter((d) => d.delta > 0)
        .map((d) => ({ productId: d.productId, quantity: d.delta }));

      if (itemsNeedingValidation.length > 0) {
        const updateValidation = await validateStockAvailability(itemsNeedingValidation);
        if (!updateValidation.valid) {
          return apiError(
            'رصيد المخزون غير كافٍ للكميات المحدّثة',
            400,
            { details: updateValidation.errors }
          );
        }
      }

      // STEP 3b: Reverse existing journal entry (prevents stale accounting records)
      const existingJournalEntry = await prisma.journalEntry.findFirst({
        where: { referenceType: 'SalesInvoice', referenceId: id },
      });
      if (existingJournalEntry) {
        await reverseJournalEntry(existingJournalEntry.id);
      }

      // STEP 4: Execute update atomically with stock delta adjustments
      const invoice = await (prisma as any).$transaction(async (tx: any) => {
        await tx.salesInvoiceItem.deleteMany({
          where: { salesInvoiceId: id },
        });

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

        // Apply net stock delta adjustments for changed quantities
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
        }

        return updatedInvoice;
      });

      // STEP 5: Create and post new journal entry with updated total
      const newTotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
      const newJournalEntry = await createSalesInvoiceEntry(invoice.id, newTotal, user.tenantId);
      if (newJournalEntry) {
        await postJournalEntry(newJournalEntry.id);
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
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_sales_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      
      if (!id) {
        return apiError('معرف الفاتورة مطلوب', 400);
      }

      // STEP 1: Reverse journal entry to restore account balances
      const existingJournalEntry = await prisma.journalEntry.findFirst({
        where: { referenceType: 'SalesInvoice', referenceId: id },
      });
      if (existingJournalEntry) {
        await reverseJournalEntry(existingJournalEntry.id);
      }

      // STEP 2: Delete invoice and reverse stock in transaction
      const deletedInvoice = await prisma.$transaction(async (tx) => {
        const invoice = await tx.salesInvoice.findFirst({
          where: { id, tenantId: user.tenantId },
          include: { items: true },
        });

        if (!invoice) {
          throw new Error('الفاتورة غير موجودة');
        }

        // Reverse stock: return the quantities that were deducted by this invoice
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

        // Delete items first to avoid foreign key constraints
        await tx.salesInvoiceItem.deleteMany({
          where: { salesInvoiceId: id },
        });

        await tx.salesInvoice.delete({
          where: { id },
        });

        return invoice;
      });

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
