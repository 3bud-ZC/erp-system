import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { checkCustomerCreditLimit } from '@/lib/business-rules';
import { workflowEngine, transitionEntity } from '@/lib/workflow-engine';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

/**
 * Sales Orders API
 * ERP Workflow Engine Integration
 * - Uses workflow state machine for all state transitions
 * - Events trigger journal entries and stock reservations
 * - DR: Unbilled Accounts Receivable (1021) on confirmation
 * - CR: Deferred Revenue (4030) on confirmation
 * - Stock reservation on confirmation (NOT deduction until invoice)
 */

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'read_sales_invoice')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const orders = await (prisma as any).salesOrder.findMany({
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
    return apiSuccess(orders, 'Orders fetched successfully');
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return handleApiError(error, 'Failed to fetch sales orders');
  }
}

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
    const { items, customerId, orderNumber, date, status, notes, total } = body;

    // Validate required fields
    if (!customerId) {
      return apiError('Customer ID is required', 400);
    }

    if (!items || items.length === 0) {
      return apiError('At least one item is required', 400);
    }

    if (!date) {
      return apiError('Date is required', 400);
    }

    // Verify customer exists
    const customer = await (prisma as any).customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return apiError('Customer not found', 404);
    }

    // Check for duplicate order number
    if (orderNumber) {
      const existing = await (prisma as any).salesOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return apiError(`Order number ${orderNumber} already exists`, 400);
      }
    }

    // Calculate total if not provided
    const calculatedTotal = total || items.reduce((sum: number, item: any) => sum + (item.quantity * (item.price || 0)), 0);

    // Check customer credit limit
    const creditCheck = await checkCustomerCreditLimit(customerId, calculatedTotal);
    if (!creditCheck.passed) {
      return apiError(creditCheck.message || 'Credit limit exceeded', 400);
    }

    // Create order with items in transaction
    const order = await (prisma as any).$transaction(async (tx: any) => {
      const newOrder = await tx.salesOrder.create({
        data: {
          orderNumber: orderNumber || `SO-${Date.now()}`,
          date: new Date(date),
          status: status || 'pending',
          notes: notes || null,
          total: calculatedTotal,
          customer: {
            connect: { id: customerId }
          },
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price || 0,
              total: (item.quantity || 0) * (item.price || 0),
            })),
          },
        },
        include: {
          customer: true,
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
      await transitionEntity('SalesOrder', order.id, 'confirmed', user.id, { calculatedTotal });
    }

    await logAuditAction(
      user.id, 'CREATE', 'sales', 'SalesOrder', order.id, { order },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(order, 'Sales order created successfully');
  } catch (error: any) {
    console.error('Error creating sales order:', error);
    return handleApiError(error, 'Create sales order');
  }
}

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
    const { id, items, orderNumber, date, status, notes, total, customerId } = body;

    if (!id) {
      return apiError('Order ID is required', 400);
    }

    if (!date) {
      return apiError('Date is required', 400);
    }

    // Verify order exists
    const existingOrder = await (prisma as any).salesOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return apiError('Sales order not found', 404);
    }

    // Check for duplicate order number (if changed)
    if (orderNumber && orderNumber !== existingOrder.orderNumber) {
      const existing = await (prisma as any).salesOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return apiError(`Order number ${orderNumber} already exists`, 400);
      }
    }

    // Calculate total if items are provided
    const calculatedTotal = items ? items.reduce((sum: number, item: any) => sum + (item.quantity * (item.price || 0)), 0) : (total || existingOrder.total);

    // Update order with workflow transition handling
    const order = await (prisma as any).$transaction(async (tx: any) => {
      // Update order
      const updatedOrder = await tx.salesOrder.update({
        where: { id },
        data: {
          orderNumber,
          date: new Date(date),
          status: status || 'pending',
          notes: notes || null,
          total: calculatedTotal,
          ...(customerId && {
            customer: {
              connect: { id: customerId }
            }
          }),
          ...(items && {
            items: {
              deleteMany: {},
              create: items.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price || 0,
                total: (item.quantity || 0) * (item.price || 0),
              })),
            },
          }),
        },
        include: {
          customer: true,
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
      await transitionEntity('SalesOrder', order.id, status, user.id, { calculatedTotal });
    }

    await logAuditAction(
      user.id, 'UPDATE', 'sales', 'SalesOrder', order.id, { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(order, 'Sales order updated successfully');
  } catch (error: any) {
    console.error('Error updating sales order:', error);
    return handleApiError(error, 'Update sales order');
  }
}

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

    // Check if order exists
    const existingOrder = await (prisma as any).salesOrder.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return apiError('Sales order not found', 404);
    }

    // Trigger workflow transition to cancelled before deletion
    await transitionEntity('SalesOrder', id, 'cancelled', user.id);

    // Delete items first, then order
    await (prisma as any).$transaction([
      (prisma as any).salesOrderItem.deleteMany({
        where: { salesOrderId: id },
      }),
      (prisma as any).salesOrder.delete({
        where: { id },
      }),
    ]);

    await logAuditAction(
      user.id, 'DELETE', 'sales', 'SalesOrder', id, undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Sales order deleted successfully');
  } catch (error: any) {
    console.error('Error deleting sales order:', error);
    return handleApiError(error, 'Delete sales order');
  }
}
