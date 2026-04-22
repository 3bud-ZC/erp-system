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

// GET - Read purchase returns
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_purchase')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const purchaseInvoiceId = searchParams.get('purchaseInvoiceId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (purchaseInvoiceId) where.purchaseInvoiceId = purchaseInvoiceId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (prisma as any).purchaseReturn.findMany({
        where,
        include: {
          supplier: true,
          purchaseInvoice: true,
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
      (prisma as any).purchaseReturn.count({ where }),
    ]);

    return apiSuccess({ purchaseReturns: data, total, page, limit }, 'Purchase returns fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch purchase returns');
  }
}

// POST - Create purchase return (Supplier Credit Note)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_purchase')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { supplierId, purchaseInvoiceId, date, reason, items } = body;

    if (!supplierId || !date || !reason) {
      return apiError('Supplier ID, date, and reason are required', 400);
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

    // Validate purchase invoice if provided
    if (purchaseInvoiceId) {
      const invoice = await (prisma as any).purchaseInvoice.findUnique({
        where: { id: purchaseInvoiceId },
      });

      if (!invoice) {
        return apiError('Purchase invoice not found', 404);
      }
    }

    // Generate return number
    const lastReturn = await (prisma as any).purchaseReturn.findFirst({
      orderBy: { returnNumber: 'desc' },
    });
    const nextNumber = lastReturn ? parseInt(lastReturn.returnNumber.slice(3)) + 1 : 1;
    const returnNumber = `PR-${String(nextNumber).padStart(6, '0')}`;

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

    // Create purchase return with transaction
    const purchaseReturn = await prisma.$transaction(async (tx) => {
      const newReturn = await (tx as any).purchaseReturn.create({
        data: {
          returnNumber,
          supplierId,
          purchaseInvoiceId,
          date: new Date(date),
          reason,
          status: 'pending',
          total,
          items: {
            create: validatedItems,
          },
        },
        include: {
          supplier: true,
          purchaseInvoice: true,
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
    await transitionEntity('PurchaseReturn', purchaseReturn.id, 'pending', user.id, { total });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'purchase', 'PurchaseReturn', purchaseReturn.id,
      { returnNumber: purchaseReturn.returnNumber, supplierId, purchaseInvoiceId, total },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(purchaseReturn, 'Purchase return created successfully');
  } catch (error) {
    return handleApiError(error, 'Create purchase return');
  }
}

// PUT - Update purchase return (approve/reject)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'update_purchase')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, status, items } = body;

    if (!id) {
      return apiError('Purchase return ID is required', 400);
    }

    // Check if return exists
    const existingReturn = await (prisma as any).purchaseReturn.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingReturn) {
      return apiError('Purchase return not found', 404);
    }

    // Update return status
    const updatedReturn = await (prisma as any).purchaseReturn.update({
      where: { id },
      data: {
        status: status || existingReturn.status,
      },
      include: {
        supplier: true,
        purchaseInvoice: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingReturn.status) {
      await transitionEntity('PurchaseReturn', id, status, user.id, { total: existingReturn.total });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'purchase', 'PurchaseReturn', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(updatedReturn, 'Purchase return updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update purchase return');
  }
}

// DELETE - Delete purchase return
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'delete_purchase')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Purchase return ID is required', 400);
    }

    // Check if return exists
    const purchaseReturn = await (prisma as any).purchaseReturn.findUnique({
      where: { id },
    });

    if (!purchaseReturn) {
      return apiError('Purchase return not found', 404);
    }

    // Prevent deletion if already processed
    if (purchaseReturn.status === 'approved') {
      return apiError('Cannot delete an approved purchase return', 400);
    }

    await (prisma as any).purchaseReturn.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'purchase', 'PurchaseReturn', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Purchase return deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete purchase return');
  }
}
