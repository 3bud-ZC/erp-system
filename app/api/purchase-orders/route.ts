import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { workflowEngine, transitionEntity } from '@/lib/workflow-engine';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

/**
 * Purchase Orders API
 * ERP Workflow Engine Integration
 * - Uses workflow state machine for all state transitions
 * - Events trigger journal entries and stock reservations
 * - DR: Unbilled Inventory (1030) on confirmation
 * - CR: Accrued Payables (2011) on confirmation
 * - Stock inflow reservation on confirmation (NOT actual stock until receipt)
 */

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'read_purchase_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const orders = await (prisma as any).purchaseOrder.findMany({
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
    return apiSuccess(orders, 'Purchase orders fetched successfully');
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return handleApiError(error, 'Fetch purchase orders');
  }
}

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
    const { items, supplierId, orderNumber, date, status, notes, total, branch, warehouse } = body;

    // Validate required fields
    if (!supplierId) {
      return apiError('Supplier ID is required', 400);
    }

    if (!items || items.length === 0) {
      return apiError('At least one item is required', 400);
    }

    if (!date) {
      return apiError('Date is required', 400);
    }

    // Verify supplier exists
    const supplier = await (prisma as any).supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return apiError('Supplier not found', 404);
    }

    // Check for duplicate order number
    if (orderNumber) {
      const existing = await (prisma as any).purchaseOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return apiError(`Order number ${orderNumber} already exists`, 400);
      }
    }

    // Calculate total if not provided
    const calculatedTotal = total || items.reduce((sum: number, item: any) => {
      const quantity = item.quantity || 0;
      const price = item.unitPrice || item.price || 0;
      return sum + (quantity * price);
    }, 0);

    // Create order with items in transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await (tx as any).purchaseOrder.create({
        data: {
          orderNumber,
          date: new Date(date),
          status: status || 'pending',
          notes: notes || null,
          total: calculatedTotal,
          supplier: {
            connect: { id: supplierId }
          },
          items: {
            create: items.map((item: any) => {
              const quantity = item.quantity || 0;
              const price = item.unitPrice || item.price || 0;
              const total = quantity * price;
              return {
                productId: item.productId,
                quantity,
                price,
                total,
              };
            }),
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

      return newOrder;
    });

    // Trigger workflow transition if status is 'confirmed'
    if (status === 'confirmed') {
      await transitionEntity('PurchaseOrder', order.id, 'ordered', user.id, { calculatedTotal });
    }

    await logAuditAction(
      user.id, 'CREATE', 'purchases', 'PurchaseOrder', order.id, { order },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(order, 'Purchase order created successfully');
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    return handleApiError(error, 'Create purchase order');
  }
}

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
    const { id, items, orderNumber, date, status, notes, total, supplierId } = body;

    if (!id) {
      return apiError('Order ID is required', 400);
    }

    if (!date) {
      return apiError('Date is required', 400);
    }

    // Verify order exists
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return apiError('Purchase order not found', 404);
    }

    // Check for duplicate order number (if changed)
    if (orderNumber && orderNumber !== existingOrder.orderNumber) {
      const existing = await (prisma as any).purchaseOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return apiError(`Order number ${orderNumber} already exists`, 400);
      }
    }

    // Calculate total if items are provided
    const calculatedTotal = items ? items.reduce((sum: number, item: any) => {
      const quantity = item.quantity || 0;
      const price = item.unitPrice || item.price || 0;
      return sum + (quantity * price);
    }, 0) : (total || existingOrder.total);

    // Update order with workflow transition handling
    const order = await prisma.$transaction(async (tx) => {
      // Update order
      const updatedOrder = await (tx as any).purchaseOrder.update({
        where: { id },
        data: {
          orderNumber,
          date: new Date(date),
          status: status || 'pending',
          notes: notes || null,
          total: calculatedTotal,
          ...(supplierId && {
            supplier: {
              connect: { id: supplierId }
            }
          }),
          ...(items && {
            items: {
              deleteMany: {},
              create: items.map((item: any) => {
                const quantity = item.quantity || 0;
                const price = item.unitPrice || item.price || 0;
                const total = quantity * price;
                return {
                  productId: item.productId,
                  quantity,
                  price,
                  total,
                };
              }),
            },
          }),
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

      return updatedOrder;
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingOrder.status) {
      await transitionEntity('PurchaseOrder', order.id, status, user.id, { calculatedTotal });
    }

    await logAuditAction(
      user.id, 'UPDATE', 'purchases', 'PurchaseOrder', order.id, { order },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(order, 'Purchase order updated successfully');
  } catch (error: any) {
    console.error('Error updating purchase order:', error);
    return handleApiError(error, 'Update purchase order');
  }
}

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
      return apiError('ID is required', 400);
    }

    // Check if order exists
    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return apiError('Purchase order not found', 404);
    }

    // Trigger workflow transition to cancelled before deletion
    await transitionEntity('PurchaseOrder', id, 'cancelled', user.id);

    await (prisma as any).$transaction([
      (prisma as any).purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } }),
      (prisma as any).purchaseOrder.delete({ where: { id } }),
    ]);

    await logAuditAction(
      user.id, 'DELETE', 'purchases', 'PurchaseOrder', id, undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Purchase order deleted successfully');
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return handleApiError(error, 'Delete purchase order');
  }
}
