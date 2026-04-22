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

// GET - Read stock transfers
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const fromWarehouseId = searchParams.get('fromWarehouseId');
    const toWarehouseId = searchParams.get('toWarehouseId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (productId) where.productId = productId;
    if (fromWarehouseId) where.fromWarehouseId = fromWarehouseId;
    if (toWarehouseId) where.toWarehouseId = toWarehouseId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (prisma as any).stockTransfer.findMany({
        where,
        include: {
          product: true,
          fromWarehouse: true,
          toWarehouse: true,
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).stockTransfer.count({ where }),
    ]);

    return apiSuccess({ stockTransfers: data, total, page, limit }, 'Stock transfers fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch stock transfers');
  }
}

// POST - Create stock transfer
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { productId, fromWarehouseId, toWarehouseId, quantity, notes, date } = body;

    if (!productId || !fromWarehouseId || !toWarehouseId || !quantity) {
      return apiError('Product ID, from warehouse ID, to warehouse ID, and quantity are required', 400);
    }

    if (fromWarehouseId === toWarehouseId) {
      return apiError('Source and destination warehouses must be different', 400);
    }

    // Validate product
    const product = await (prisma as any).product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return apiError('Product not found', 404);
    }

    // Validate warehouses
    const [fromWarehouse, toWarehouse] = await Promise.all([
      (prisma as any).warehouse.findUnique({ where: { id: fromWarehouseId } }),
      (prisma as any).warehouse.findUnique({ where: { id: toWarehouseId } }),
    ]);

    if (!fromWarehouse) {
      return apiError('Source warehouse not found', 404);
    }

    if (!toWarehouse) {
      return apiError('Destination warehouse not found', 404);
    }

    // Check if there's enough stock in the source warehouse
    if (product.stock < quantity) {
      return apiError(`Insufficient stock. Available: ${product.stock}, Required: ${quantity}`, 400);
    }

    // Generate transfer number
    const lastTransfer = await (prisma as any).stockTransfer.findFirst({
      orderBy: { transferNumber: 'desc' },
    });
    const nextNumber = lastTransfer ? parseInt(lastTransfer.transferNumber.slice(3)) + 1 : 1;
    const transferNumber = `ST-${String(nextNumber).padStart(6, '0')}`;

    // Create transfer in pending state
    const transfer = await (prisma as any).stockTransfer.create({
      data: {
        transferNumber,
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity,
        status: 'pending',
        date: date ? new Date(date) : new Date(),
        notes,
      },
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
      },
    });

    // Trigger workflow transition
    await transitionEntity('StockTransfer', transfer.id, 'pending', user.id, { quantity });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'inventory', 'StockTransfer', transfer.id,
      { transferNumber: transfer.transferNumber, productId, fromWarehouseId, toWarehouseId, quantity },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(transfer, 'Stock transfer created successfully');
  } catch (error) {
    return handleApiError(error, 'Create stock transfer');
  }
}

// PUT - Update stock transfer
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id) {
      return apiError('Stock transfer ID is required', 400);
    }

    // Check if transfer exists
    const existingTransfer = await (prisma as any).stockTransfer.findUnique({
      where: { id },
    });

    if (!existingTransfer) {
      return apiError('Stock transfer not found', 404);
    }

    // Prevent modification if already completed
    if (existingTransfer.status === 'completed') {
      return apiError('Cannot modify a completed stock transfer', 400);
    }

    // Update transfer
    const transfer = await (prisma as any).stockTransfer.update({
      where: { id },
      data: {
        status: status || existingTransfer.status,
        notes: notes || existingTransfer.notes,
      },
      include: {
        product: true,
        fromWarehouse: true,
        toWarehouse: true,
      },
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingTransfer.status) {
      await transitionEntity('StockTransfer', id, status, user.id, { quantity: existingTransfer.quantity });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'inventory', 'StockTransfer', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(transfer, 'Stock transfer updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update stock transfer');
  }
}

// DELETE - Delete stock transfer
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Stock transfer ID is required', 400);
    }

    // Check if transfer exists
    const transfer = await (prisma as any).stockTransfer.findUnique({
      where: { id },
    });

    if (!transfer) {
      return apiError('Stock transfer not found', 404);
    }

    // Prevent deletion if already completed
    if (transfer.status === 'completed') {
      return apiError('Cannot delete a completed stock transfer', 400);
    }

    await (prisma as any).stockTransfer.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'inventory', 'StockTransfer', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Stock transfer deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete stock transfer');
  }
}
