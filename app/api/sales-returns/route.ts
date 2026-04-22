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

// GET - Read sales returns
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_sales')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const salesInvoiceId = searchParams.get('salesInvoiceId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (salesInvoiceId) where.salesInvoiceId = salesInvoiceId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (prisma as any).salesReturn.findMany({
        where,
        include: {
          customer: true,
          salesInvoice: true,
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
      (prisma as any).salesReturn.count({ where }),
    ]);

    return apiSuccess({ salesReturns: data, total, page, limit }, 'Sales returns fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch sales returns');
  }
}

// POST - Create sales return (Credit Note)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_sales')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { customerId, salesInvoiceId, date, reason, items } = body;

    if (!customerId || !date || !reason) {
      return apiError('Customer ID, date, and reason are required', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiError('At least one item is required', 400);
    }

    // Validate customer
    const customer = await (prisma as any).customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return apiError('Customer not found', 404);
    }

    // Validate sales invoice if provided
    if (salesInvoiceId) {
      const invoice = await (prisma as any).salesInvoice.findUnique({
        where: { id: salesInvoiceId },
      });

      if (!invoice) {
        return apiError('Sales invoice not found', 404);
      }
    }

    // Generate return number
    const lastReturn = await (prisma as any).salesReturn.findFirst({
      orderBy: { returnNumber: 'desc' },
    });
    const nextNumber = lastReturn ? parseInt(lastReturn.returnNumber.slice(3)) + 1 : 1;
    const returnNumber = `SR-${String(nextNumber).padStart(6, '0')}`;

    // Calculate totals and validate items
    let total = 0;
    const validatedItems: any[] = [];
    for (const item of items) {
      const product = await (prisma as any).product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return apiError(`Product ${item.productId} not found`, 404);
      }

      const itemTotal = item.quantity * item.price;
      total += itemTotal;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal,
      });
    }

    // Create sales return with transaction
    const salesReturn = await prisma.$transaction(async (tx) => {
      const newReturn = await (tx as any).salesReturn.create({
        data: {
          returnNumber,
          customerId,
          salesInvoiceId,
          date: new Date(date),
          reason,
          status: 'pending',
          total,
          items: {
            create: validatedItems,
          },
        },
        include: {
          customer: true,
          salesInvoice: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return newReturn;
    });

    // Trigger workflow transition
    await transitionEntity('SalesReturn', salesReturn.id, 'pending', user.id, { total });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'sales', 'SalesReturn', salesReturn.id,
      { returnNumber: salesReturn.returnNumber, customerId, salesInvoiceId, total },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(salesReturn, 'Sales return created successfully');
  } catch (error) {
    return handleApiError(error, 'Create sales return');
  }
}

// PUT - Update sales return (approve/reject)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'update_sales')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, status, items } = body;

    if (!id) {
      return apiError('Sales return ID is required', 400);
    }

    // Check if return exists
    const existingReturn = await (prisma as any).salesReturn.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingReturn) {
      return apiError('Sales return not found', 404);
    }

    // Update return status
    const updatedReturn = await (prisma as any).salesReturn.update({
      where: { id },
      data: {
        status: status || existingReturn.status,
      },
      include: {
        customer: true,
        salesInvoice: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingReturn.status) {
      await transitionEntity('SalesReturn', id, status, user.id, { total: existingReturn.total });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'sales', 'SalesReturn', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(updatedReturn, 'Sales return updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update sales return');
  }
}

// DELETE - Delete sales return
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'delete_sales')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Sales return ID is required', 400);
    }

    // Check if return exists
    const salesReturn = await (prisma as any).salesReturn.findUnique({
      where: { id },
    });

    if (!salesReturn) {
      return apiError('Sales return not found', 404);
    }

    // Prevent deletion if already processed
    if (salesReturn.status === 'approved') {
      return apiError('Cannot delete an approved sales return', 400);
    }

    await (prisma as any).salesReturn.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'sales', 'SalesReturn', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Sales return deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete sales return');
  }
}
