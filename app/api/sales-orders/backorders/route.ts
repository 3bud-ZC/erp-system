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

// GET - Get backorders
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_sales')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'pending', 'partial', 'fulfilled'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    // Find sales orders with backordered items (items where remainingQuantity > 0)
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        items: {
          some: {
            remainingQuantity: { gt: 0 },
          },
        },
        ...(status ? { status } : {}),
      },
      include: {
        customer: true,
        items: {
          where: {
            remainingQuantity: { gt: 0 },
          },
        },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.salesOrder.count({
      where: {
        items: {
          some: {
            remainingQuantity: { gt: 0 },
          },
        },
        ...(status ? { status } : {}),
      },
    });

    return apiSuccess({ backorders: salesOrders, total, page, limit }, 'Backorders fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch backorders');
  }
}

// POST - Fulfill backorder
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_sales')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { salesOrderId, items } = body; // items: [{ salesOrderItemId, quantityToFulfill }]

    if (!salesOrderId || !items || !Array.isArray(items)) {
      return apiError('Sales order ID and items array are required', 400);
    }

    // Get sales order
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        items: true,
      },
    });

    if (!salesOrder) {
      return apiError('Sales order not found', 404);
    }

    // Fulfill items
    for (const item of items) {
      const orderItem = salesOrder.items.find((oi) => oi.id === item.salesOrderItemId);
      if (!orderItem) {
        return apiError(`Order item ${item.salesOrderItemId} not found`, 404);
      }

      const quantityToFulfill = Math.min(item.quantityToFulfill, orderItem.remainingQuantity);
      if (quantityToFulfill <= 0) {
        return apiError(`Invalid quantity to fulfill for item ${item.salesOrderItemId}`, 400);
      }

      // Update order item
      await prisma.salesOrderItem.update({
        where: { id: item.salesOrderItemId },
        data: {
          invoicedQuantity: orderItem.invoicedQuantity + quantityToFulfill,
          remainingQuantity: orderItem.remainingQuantity - quantityToFulfill,
          fulfillmentStatus: (orderItem.remainingQuantity - quantityToFulfill) <= 0 ? 'fulfilled' : 'partially_fulfilled',
        },
      });
    }

    // Check if order is fully fulfilled
    const updatedOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { items: true },
    });

    const allItemsFulfilled = updatedOrder?.items.every((item) => item.fulfillmentStatus === 'fulfilled');
    if (allItemsFulfilled) {
      await transitionEntity('SalesOrder', salesOrderId, 'fulfilled', user.id, { fulfillmentDate: new Date() });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'FULFILL_BACKORDER', 'sales', 'SalesOrder', salesOrderId,
      { items },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ salesOrderId, fulfilled: allItemsFulfilled }, 'Backorder fulfilled successfully');
  } catch (error) {
    return handleApiError(error, 'Fulfill backorder');
  }
}
