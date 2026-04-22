import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { createJournalEntry, postJournalEntry } from '@/lib/accounting';
import { transitionEntity } from '@/lib/workflow-engine';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Read stock adjustments
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (productId) where.productId = productId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [data, total] = await Promise.all([
      (prisma as any).stockAdjustment.findMany({
        where,
        include: {
          product: true,
          journalEntry: true,
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).stockAdjustment.count({ where }),
    ]);

    return apiSuccess({ stockAdjustments: data, total, page, limit }, 'Stock adjustments fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch stock adjustments');
  }
}

// POST - Create stock adjustment
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { productId, type, quantity, reason, notes, date } = body;

    if (!productId || !type || !quantity || !reason) {
      return apiError('Product ID, type, quantity, and reason are required', 400);
    }

    if (type !== 'increase' && type !== 'decrease') {
      return apiError('Type must be either "increase" or "decrease"', 400);
    }

    // Validate product
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return apiError('Product not found', 404);
    }

    // Generate adjustment number
    const lastAdjustment = await (prisma as any).stockAdjustment.findFirst({
      orderBy: { adjustmentNumber: 'desc' },
    });
    const nextNumber = lastAdjustment ? parseInt(lastAdjustment.adjustmentNumber.slice(3)) + 1 : 1;
    const adjustmentNumber = `SA-${String(nextNumber).padStart(6, '0')}`;

    // Create adjustment with journal entry in transaction
    const adjustment = await prisma.$transaction(async (tx) => {
      const newAdjustment = await (tx as any).stockAdjustment.create({
        data: {
          adjustmentNumber,
          productId,
          type,
          quantity,
          reason,
          status: 'pending',
          date: date ? new Date(date) : new Date(),
          notes,
          tenantId: user.tenantId,
        },
        include: {
          product: true,
        },
      });

      // Update stock
      const stockChange = type === 'increase' ? quantity : -quantity;
      await tx.product.update({
        where: { id: productId },
        data: {
          stock: {
            increment: stockChange,
          },
        },
      });

      // Create inventory transaction
      await (tx as any).inventoryTransaction.create({
        data: {
          productId,
          type: 'adjustment',
          quantity: stockChange,
          referenceId: newAdjustment.id,
          date: date ? new Date(date) : new Date(),
          notes: `Stock Adjustment ${adjustmentNumber} - ${reason}`,
          tenantId: user.tenantId,
        },
      });

      // Create journal entry
      const journalEntry = await createJournalEntry({
        entryDate: date ? new Date(date) : new Date(),
        description: `Stock Adjustment ${adjustmentNumber} - ${reason}`,
        referenceType: 'StockAdjustment',
        referenceId: newAdjustment.id,
        lines: type === 'increase' ? [
          {
            accountCode: '1030', // Inventory
            debit: quantity * product.cost,
            credit: 0,
            description: `Inventory increase for ${product.nameAr || product.nameEn}`,
          },
          {
            accountCode: '5070', // Inventory Adjustment
            debit: 0,
            credit: quantity * product.cost,
            description: `Inventory adjustment credit for ${product.nameAr || product.nameEn}`,
          },
        ] : [
          {
            accountCode: '5070', // Inventory Adjustment
            debit: quantity * product.cost,
            credit: 0,
            description: `Inventory decrease for ${product.nameAr || product.nameEn}`,
          },
          {
            accountCode: '1030', // Inventory
            debit: 0,
            credit: quantity * product.cost,
            description: `Inventory adjustment debit for ${product.nameAr || product.nameEn}`,
          },
        ],
      }, user.id);

      await postJournalEntry(journalEntry.id, user.id);

      // Link journal entry to adjustment
      await (tx as any).stockAdjustment.update({
        where: { id: newAdjustment.id },
        data: {
          journalEntryId: journalEntry.id,
          status: 'approved',
        },
      });

      return (tx as any).stockAdjustment.findUnique({
        where: { id: newAdjustment.id },
        include: {
          product: true,
          journalEntry: true,
        },
      });
    });

    // Trigger workflow transition
    await transitionEntity('StockAdjustment', adjustment.id, 'approved', user.id, { quantity, type });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'inventory', 'StockAdjustment', adjustment.id,
      { adjustmentNumber: adjustment.adjustmentNumber, productId, type, quantity },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(adjustment, 'Stock adjustment created successfully');
  } catch (error) {
    return handleApiError(error, 'Create stock adjustment');
  }
}

// PUT - Update stock adjustment (approve/reject)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id) {
      return apiError('Stock adjustment ID is required', 400);
    }

    // Check if adjustment exists
    const existingAdjustment = await (prisma as any).stockAdjustment.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!existingAdjustment) {
      return apiError('Stock adjustment not found', 404);
    }

    // Update adjustment
    const adjustment = await (prisma as any).stockAdjustment.update({
      where: { id },
      data: {
        status: status || existingAdjustment.status,
        notes: notes || existingAdjustment.notes,
      },
      include: {
        product: true,
        journalEntry: true,
      },
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingAdjustment.status) {
      await transitionEntity('StockAdjustment', id, status, user.id, { quantity: existingAdjustment.quantity, type: existingAdjustment.type });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'inventory', 'StockAdjustment', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(adjustment, 'Stock adjustment updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update stock adjustment');
  }
}

// DELETE - Delete stock adjustment
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Stock adjustment ID is required', 400);
    }

    // Check if adjustment exists
    const adjustment = await (prisma as any).stockAdjustment.findUnique({
      where: { id },
    });

    if (!adjustment) {
      return apiError('Stock adjustment not found', 404);
    }

    // Prevent deletion if already approved
    if (adjustment.status === 'approved') {
      return apiError('Cannot delete an approved stock adjustment', 400);
    }

    await (prisma as any).stockAdjustment.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'inventory', 'StockAdjustment', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Stock adjustment deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete stock adjustment');
  }
}
