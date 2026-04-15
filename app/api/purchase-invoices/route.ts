import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { incrementStockInTransaction } from '@/lib/inventory';
import { createPurchaseInvoiceEntry, postJournalEntry } from '@/lib/accounting';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read purchase invoices (requires read_purchase_invoice permission)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const invoices = await prisma.purchaseInvoice.findMany({
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
      const { items, ...invoiceData } = body;

      // Calculate total server-side
      const total = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);

      const invoice = await prisma.$transaction(async (tx) => {
        const newInvoice = await tx.purchaseInvoice.create({
          data: {
            ...invoiceData,
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
        await incrementStockInTransaction(tx, items, newInvoice.id, 'PurchaseInvoice');

        return newInvoice;
      });

      // Create and post accounting journal entry (DR Inventory / CR Payables)
      const journalEntry = await createPurchaseInvoiceEntry(invoice.id, total);
      if (journalEntry) {
        await postJournalEntry(journalEntry.id);
      }

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

      return apiSuccess(invoice, 'Purchase invoice created successfully');
    } catch (error) {
      return handleApiError(error, 'Create purchase invoice');
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

      // STEP 1: Fetch existing invoice to calculate stock delta
      const existingInvoice = await prisma.purchaseInvoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingInvoice) {
        return handleApiError(new Error('Invoice not found'), 'Update purchase invoice');
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

      // STEP 3: Execute update atomically with stock delta adjustments
      const invoice = await prisma.$transaction(async (tx) => {
        await tx.purchaseInvoiceItem.deleteMany({
          where: { purchaseInvoiceId: id },
        });

        const updatedInvoice = await tx.purchaseInvoice.update({
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
            data: {
              stock: {
                increment: delta.delta,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: delta.productId,
              type: 'IN',
              quantity: delta.delta,
              reference: id,
              referenceType: 'PurchaseInvoice',
            },
          });
        }

        return updatedInvoice;
      });

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
        return handleApiError(new Error('ID is required'), 'Delete purchase invoice');
      }

      await prisma.$transaction(async (tx) => {
        const invoice = await tx.purchaseInvoice.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!invoice) {
          throw new Error('Invoice not found');
        }

        // Reverse stock: remove the quantities that were added by this invoice
        for (const item of invoice.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'IN',
              quantity: -item.quantity,
              reference: id,
              referenceType: 'PurchaseInvoice',
              notes: 'Deleted invoice reversal',
            },
          });
        }

        // Delete items first to avoid foreign key constraints
        await tx.purchaseInvoiceItem.deleteMany({
          where: { purchaseInvoiceId: id },
        });

        await tx.purchaseInvoice.delete({
          where: { id },
        });
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

      return apiSuccess({ id }, 'Purchase invoice deleted successfully');
    } catch (error) {
      return handleApiError(error, 'Delete purchase invoice');
    }
  }
