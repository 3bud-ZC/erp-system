import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';

/**
 * Purchase Orders API
 * Important: Purchase orders do NOT affect stock.
 * Stock is only affected when a Purchase Invoice is created/received.
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

    const orders = await prisma.purchaseOrder.findMany({
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
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return apiError('Supplier not found', 404);
    }

    // Check for duplicate order number
    if (orderNumber) {
      const existing = await prisma.purchaseOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return apiError(`Order number ${orderNumber} already exists`, 400);
      }
    }

    // Create order with items - use connect for supplier relation
    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        date: new Date(date),
        status: status || 'pending',
        notes: notes || null,
        total: total || 0,
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
      const existing = await prisma.purchaseOrder.findUnique({
        where: { orderNumber },
      });
      if (existing) {
        return apiError(`Order number ${orderNumber} already exists`, 400);
      }
    }

    // Update order
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        orderNumber,
        date: new Date(date),
        status: status || 'pending',
        notes: notes || null,
        total: total || 0,
        ...(supplierId && {
          supplier: {
            connect: { id: supplierId }
          }
        }),
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

    await prisma.$transaction([
      prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } }),
      prisma.purchaseOrder.delete({ where: { id } }),
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
