import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { transitionEntity } from '@/lib/workflow-engine';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Read goods receipts
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_purchase')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const purchaseOrderId = searchParams.get('purchaseOrderId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (prisma as any).goodsReceipt.findMany({
        where,
        include: {
          purchaseOrder: {
            include: {
              supplier: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).goodsReceipt.count({ where }),
    ]);

    return apiSuccess({ goodsReceipts: data, total, page, limit }, 'Goods receipts fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch goods receipts');
  }
}

// POST - Create goods receipt
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_purchase')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { purchaseOrderId, date, notes, items } = body;

    if (!purchaseOrderId || !date || !items || !Array.isArray(items) || items.length === 0) {
      return apiError('Purchase order ID, date, and items are required', 400);
    }

    // Validate purchase order
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: true,
        supplier: true,
      },
    });

    if (!purchaseOrder) {
      return apiError('Purchase order not found', 404);
    }

    // Check if goods receipt already exists for this PO
    const existingReceipt = await (prisma as any).goodsReceipt.findUnique({
      where: { purchaseOrderId },
    });

    if (existingReceipt) {
      return apiError('Goods receipt already exists for this purchase order', 400);
    }

    // Generate receipt number
    const lastReceipt = await (prisma as any).goodsReceipt.findFirst({
      orderBy: { receiptNumber: 'desc' },
    });
    const nextNumber = lastReceipt ? parseInt(lastReceipt.receiptNumber.slice(3)) + 1 : 1;
    const receiptNumber = `GR-${String(nextNumber).padStart(6, '0')}`;

    // Validate items and calculate variances
    const validatedItems = [];
    let total = 0;

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return apiError(`Product ${item.productId} not found`, 404);
      }

      // Find the corresponding PO item
      const poItem = purchaseOrder.items.find((poItem) => poItem.productId === item.productId);
      if (!poItem) {
        return apiError(`Product ${item.productId} not found in purchase order`, 400);
      }

      const orderedQuantity = poItem.quantity;
      const receivedQuantity = item.receivedQuantity;
      const variance = receivedQuantity - orderedQuantity;
      const price = poItem.price;
      const itemTotal = receivedQuantity * price;
      total += itemTotal;

      validatedItems.push({
        productId: item.productId,
        orderedQuantity,
        receivedQuantity,
        variance,
        notes: item.notes,
      });
    }

    // Create goods receipt
    const goodsReceipt = await (prisma as any).goodsReceipt.create({
      data: {
        receiptNumber,
        purchaseOrderId,
        date: new Date(date),
        status: 'pending',
        notes,
        total,
        tenantId: user.tenantId,
        items: {
          create: validatedItems,
        },
      },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Trigger workflow transition
    await transitionEntity('GoodsReceipt', goodsReceipt.id, 'pending', user.id, { total });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'purchase', 'GoodsReceipt', goodsReceipt.id,
      { receiptNumber: goodsReceipt.receiptNumber, purchaseOrderId, total },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(goodsReceipt, 'Goods receipt created successfully');
  } catch (error) {
    return handleApiError(error, 'Create goods receipt');
  }
}

// PUT - Update goods receipt (receive/verify)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'update_purchase')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id) {
      return apiError('Goods receipt ID is required', 400);
    }

    // Check if receipt exists
    const existingReceipt = await (prisma as any).goodsReceipt.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        purchaseOrder: true,
      },
    });

    if (!existingReceipt) {
      return apiError('Goods receipt not found', 404);
    }

    // Update receipt
    const receipt = await (prisma as any).goodsReceipt.update({
      where: { id },
      data: {
        status: status || existingReceipt.status,
        notes: notes || existingReceipt.notes,
      },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingReceipt.status) {
      await transitionEntity('GoodsReceipt', id, status, user.id, { status });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'purchase', 'GoodsReceipt', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(receipt, 'Goods receipt updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update goods receipt');
  }
}

// DELETE - Delete goods receipt
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'delete_purchase')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Goods receipt ID is required', 400);
    }

    // Check if receipt exists
    const receipt = await (prisma as any).goodsReceipt.findUnique({
      where: { id },
    });

    if (!receipt) {
      return apiError('Goods receipt not found', 404);
    }

    // Prevent deletion if already verified
    if (receipt.status === 'verified') {
      return apiError('Cannot delete a verified goods receipt', 400);
    }

    await (prisma as any).goodsReceipt.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'purchase', 'GoodsReceipt', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Goods receipt deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete goods receipt');
  }
}
