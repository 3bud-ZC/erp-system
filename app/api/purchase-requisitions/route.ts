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

// GET - Read purchase requisitions
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_purchase')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (prisma as any).purchaseRequisition.findMany({
        where,
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
          convertedToOrder: true,
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).purchaseRequisition.count({ where }),
    ]);

    return apiSuccess({ purchaseRequisitions: data, total, page, limit }, 'Purchase requisitions fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch purchase requisitions');
  }
}

// POST - Create purchase requisition
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_purchase')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { supplierId, date, requiredBy, notes, items } = body;

    if (!supplierId || !date || !requiredBy) {
      return apiError('Supplier ID, date, and required by are required', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiError('At least one item is required', 400);
    }

    // Validate supplier
    const supplier = await (prisma as any).supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return apiError('Supplier not found', 404);
    }

    // Generate requisition number
    const lastRequisition = await (prisma as any).purchaseRequisition.findFirst({
      orderBy: { requisitionNumber: 'desc' },
    });
    const nextNumber = lastRequisition ? parseInt(lastRequisition.requisitionNumber.slice(3)) + 1 : 1;
    const requisitionNumber = `PR-${String(nextNumber).padStart(6, '0')}`;

    // Calculate totals
    let total = 0;

    const validatedItems = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return apiError(`Product ${item.productId} not found`, 404);
      }

      const itemTotal = item.quantity * (item.estimatedPrice || product.cost || 0);
      total += itemTotal;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        estimatedPrice: item.estimatedPrice || product.cost || 0,
        total: itemTotal,
        notes: item.notes,
      });
    }

    const requisition = await (prisma as any).purchaseRequisition.create({
      data: {
        requisitionNumber,
        supplierId,
        date: new Date(date),
        requiredBy: new Date(requiredBy),
        notes,
        total,
        status: 'draft',
        items: {
          create: validatedItems,
        },
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Trigger workflow transition
    await transitionEntity('PurchaseRequisition', requisition.id, 'draft', user.id, { total });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'purchase', 'PurchaseRequisition', requisition.id,
      { requisitionNumber: requisition.requisitionNumber, supplierId, total },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(requisition, 'Purchase requisition created successfully');
  } catch (error) {
    return handleApiError(error, 'Create purchase requisition');
  }
}

// PUT - Update purchase requisition
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'update_purchase')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, supplierId, date, requiredBy, notes, status, items } = body;

    if (!id) {
      return apiError('Purchase requisition ID is required', 400);
    }

    // Check if requisition exists
    const existingRequisition = await (prisma as any).purchaseRequisition.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingRequisition) {
      return apiError('Purchase requisition not found', 404);
    }

    // Prevent updates if already converted
    if (existingRequisition.status === 'converted') {
      return apiError('Cannot update a converted requisition', 400);
    }

    // Handle approval
    let approvedBy = undefined;
    let approvedAt = undefined;
    if (status === 'approved') {
      approvedBy = user.id;
      approvedAt = new Date();
    }

    // Recalculate totals if items are provided
    let total = existingRequisition.total;

    if (items && Array.isArray(items)) {
      total = 0;

      // Delete existing items
      await (prisma as any).purchaseRequisitionItem.deleteMany({
        where: { purchaseRequisitionId: id },
      });

      // Create new items
      const validatedItems = [];
      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          return apiError(`Product ${item.productId} not found`, 404);
        }

        const itemTotal = item.quantity * (item.estimatedPrice || product.cost || 0);
        total += itemTotal;

        validatedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          estimatedPrice: item.estimatedPrice || product.cost || 0,
          total: itemTotal,
          notes: item.notes,
        });
      }

      const updatedRequisition = await (prisma as any).purchaseRequisition.update({
        where: { id },
        data: {
          supplierId,
          date: date ? new Date(date) : undefined,
          requiredBy: requiredBy ? new Date(requiredBy) : undefined,
          notes,
          status,
          total,
          approvedBy,
          approvedAt,
          items: {
            create: validatedItems,
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Trigger workflow transition if status changed
      if (status && status !== existingRequisition.status) {
        await transitionEntity('PurchaseRequisition', id, status, user.id, { total });
      }

      // Audit logging
      await logAuditAction(
        user.id, 'UPDATE', 'purchase', 'PurchaseRequisition', id,
        { body },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(updatedRequisition, 'Purchase requisition updated successfully');
    } else {
      const updatedRequisition = await (prisma as any).purchaseRequisition.update({
        where: { id },
        data: {
          supplierId,
          date: date ? new Date(date) : undefined,
          requiredBy: requiredBy ? new Date(requiredBy) : undefined,
          notes,
          status,
          approvedBy,
          approvedAt,
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Trigger workflow transition if status changed
      if (status && status !== existingRequisition.status) {
        await transitionEntity('PurchaseRequisition', id, status, user.id, { total });
      }

      // Audit logging
      await logAuditAction(
        user.id, 'UPDATE', 'purchase', 'PurchaseRequisition', id,
        { body },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(updatedRequisition, 'Purchase requisition updated successfully');
    }
  } catch (error) {
    return handleApiError(error, 'Update purchase requisition');
  }
}

// DELETE - Delete purchase requisition
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'delete_purchase')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Purchase requisition ID is required', 400);
    }

    // Check if requisition exists
    const requisition = await (prisma as any).purchaseRequisition.findUnique({
      where: { id },
    });

    if (!requisition) {
      return apiError('Purchase requisition not found', 404);
    }

    // Prevent deletion if already converted or approved
    if (requisition.status === 'converted' || requisition.status === 'approved') {
      return apiError('Cannot delete a converted or approved requisition', 400);
    }

    await (prisma as any).purchaseRequisition.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'purchase', 'PurchaseRequisition', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Purchase requisition deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete purchase requisition');
  }
}
