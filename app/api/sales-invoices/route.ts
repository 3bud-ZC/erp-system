import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { validateStockAvailability } from '@/lib/inventory';
import { decrementStockWithTransaction, atomicDecrementStock, createInventoryTransaction } from '@/lib/inventory-transactions';
import { createSalesInvoiceEntry, postJournalEntry, reverseJournalEntry } from '@/lib/accounting';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read sales invoices (requires read_sales_invoice permission)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const invoices = await prisma.salesInvoice.findMany({
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

      // STEP 1: Quick pre-check for early user-friendly error (outside transaction)
      const validation = await validateStockAvailability(items);
      if (!validation.valid) {
        return apiError(
          'رصيد المخزون غير كافٍ لأحد المنتجات أو أكثر',
          400,
          { details: validation.errors }
        );
      }

      // STEP 2: Create invoice, atomically decrement stock, and create journal entry in one transaction.
      // This ensures atomicity: if journal entry fails, stock update also rolls back.
      const total = items.reduce((sum: number, item: any) => sum + (item.quantity * item.price), 0);
      const invoice = await prisma.$transaction(async (tx) => {
        const newInvoice = await tx.salesInvoice.create({
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

        // Atomic stock decrement: throws and rolls back if stock becomes insufficient
        await atomicDecrementStock(tx, items, newInvoice.id, 'sale');

        // Create journal entry inside transaction for atomicity
        const journalEntry = await createSalesInvoiceEntry(newInvoice.id, total);
        if (journalEntry) {
          await postJournalEntry(journalEntry.id);
        }

        return newInvoice;
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

      return apiSuccess(invoice, 'Sales invoice created successfully');
    } catch (error) {
      return handleApiError(error, 'Create sales invoice');
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

      // STEP 1: Fetch existing invoice to calculate stock delta
      const existingInvoice = await prisma.salesInvoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingInvoice) {
        return apiError('Invoice not found', 404);
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
      const invoice = await prisma.$transaction(async (tx) => {
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
      const newJournalEntry = await createSalesInvoiceEntry(invoice.id, newTotal);
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
        return apiError('ID is required', 400);
      }

      // STEP 1: Reverse journal entry to restore account balances
      const existingJournalEntry = await prisma.journalEntry.findFirst({
        where: { referenceType: 'SalesInvoice', referenceId: id },
      });
      if (existingJournalEntry) {
        await reverseJournalEntry(existingJournalEntry.id);
      }

      // STEP 2: Delete invoice and reverse stock in transaction
      await prisma.$transaction(async (tx) => {
        const invoice = await tx.salesInvoice.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!invoice) {
          throw new Error('Invoice not found');
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

      return apiSuccess({ id }, 'Sales invoice deleted successfully');
    } catch (error) {
      return handleApiError(error, 'Delete sales invoice');
    }
  }
