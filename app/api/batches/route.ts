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

// GET - Read batches
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const status = searchParams.get('status');
    const expiringSoon = searchParams.get('expiringSoon'); // Get batches expiring within 30 days
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (productId) where.productId = productId;
    if (status) where.status = status;

    if (expiringSoon === 'true') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      where.expiryDate = {
        lte: thirtyDaysFromNow,
        gte: new Date(),
      };
      where.status = 'active';
    }

    const [data, total] = await Promise.all([
      (prisma as any).batch.findMany({
        where,
        include: {
          product: true,
        },
        orderBy: { expiryDate: 'asc' },
        skip,
        take: limit,
      }),
      (prisma as any).batch.count({ where }),
    ]);

    return apiSuccess({ batches: data, total, page, limit }, 'Batches fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch batches');
  }
}

// POST - Create batch
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { productId, quantity, expiryDate, manufacturingDate, notes } = body;

    if (!productId || !quantity) {
      return apiError('Product ID and quantity are required', 400);
    }

    // Validate product
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return apiError('Product not found', 404);
    }

    // Generate batch number
    const lastBatch = await (prisma as any).batch.findFirst({
      orderBy: { batchNumber: 'desc' },
    });
    const nextNumber = lastBatch ? parseInt(lastBatch.batchNumber.slice(3)) + 1 : 1;
    const batchNumber = `BTH-${String(nextNumber).padStart(6, '0')}`;

    // Create batch
    const batch = await (prisma as any).batch.create({
      data: {
        batchNumber,
        productId,
        quantity,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
        status: 'active',
        notes,
        tenantId: user.tenantId,
      },
      include: {
        product: true,
      },
    });

    // Trigger workflow transition
    await transitionEntity('Batch', batch.id, 'active', user.id, { quantity });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'inventory', 'Batch', batch.id,
      { batchNumber: batch.batchNumber, productId, quantity },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(batch, 'Batch created successfully');
  } catch (error) {
    return handleApiError(error, 'Create batch');
  }
}

// PUT - Update batch
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, status, quantity, notes } = body;

    if (!id) {
      return apiError('Batch ID is required', 400);
    }

    // Check if batch exists
    const existingBatch = await (prisma as any).batch.findUnique({
      where: { id },
    });

    if (!existingBatch) {
      return apiError('Batch not found', 404);
    }

    // Update batch
    const batch = await (prisma as any).batch.update({
      where: { id },
      data: {
        status: status || undefined,
        quantity: quantity || undefined,
        notes: notes || undefined,
      },
      include: {
        product: true,
      },
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingBatch.status) {
      await transitionEntity('Batch', id, status, user.id, { quantity: existingBatch.quantity });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'inventory', 'Batch', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(batch, 'Batch updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update batch');
  }
}

// DELETE - Delete batch
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Batch ID is required', 400);
    }

    // Check if batch exists
    const batch = await (prisma as any).batch.findUnique({
      where: { id },
    });

    if (!batch) {
      return apiError('Batch not found', 404);
    }

    // Prevent deletion if batch is consumed
    if (batch.status === 'consumed') {
      return apiError('Cannot delete a consumed batch', 400);
    }

    await (prisma as any).batch.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'inventory', 'Batch', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Batch deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete batch');
  }
}
