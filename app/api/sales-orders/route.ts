import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';

/**
 * Sales Orders API
 * Important: Sales orders do NOT affect stock.
 * Stock is only affected when a Sales Invoice is created/confirmed.
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

    const orders = await prisma.salesOrder.findMany({
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
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return apiError('Customer not found', 404);
    }

    // Check for duplicate order number
    if (orderNumber) {
      const existing = await prisma.salesOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return apiError(`Order number ${orderNumber} already exists`, 400);
      }
    }

    // Create order with items - use connect for customer relation
    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: orderNumber || `SO-${Date.now()}`,
        date: new Date(date),
        status: status || 'pending',
        notes: notes || null,
        total: total || 0,
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
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      return apiError('Sales order not found', 404);
    }

    // Check for duplicate order number (if changed)
    if (orderNumber && orderNumber !== existingOrder.orderNumber) {
      const existing = await prisma.salesOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return apiError(`Order number ${orderNumber} already exists`, 400);
      }
    }

    // Update order
    const order = await prisma.salesOrder.update({
      where: { id },
      data: {
        orderNumber,
        date: new Date(date),
        status: status || 'pending',
        notes: notes || null,
        total: total || 0,
        ...(customerId && {
          customer: {
            connect: { id: customerId }
          }
        }),
        items: {
          deleteMany: {},
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

    // Delete items first, then order
    await prisma.$transaction([
      prisma.salesOrderItem.deleteMany({
        where: { salesOrderId: id },
      }),
      prisma.salesOrder.delete({
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
