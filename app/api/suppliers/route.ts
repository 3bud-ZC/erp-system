import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read suppliers
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return apiSuccess(suppliers, 'Suppliers fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch suppliers');
  }
}

// POST - Create supplier
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_supplier')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const body = await request.json();
    // @ts-ignore - Prisma type mismatch - tenant relation not in generated types
    const supplier = await prisma.supplier.create({
      data: { ...body, tenant: { connect: { id: user.tenantId } } },
    });

    await logAuditAction(
      user.id,
      'CREATE',
      'purchases',
      'Supplier',
      supplier.id,
      { supplier },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(supplier, 'Supplier created successfully');
  } catch (error) {
    return handleApiError(error, 'Create supplier');
  }
}

// PUT - Update supplier
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_supplier')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const { id, ...data } = body;
    const supplier = await prisma.supplier.update({
      where: { id },
      data,
    });

    await logAuditAction(
      user.id,
      'UPDATE',
      'purchases',
      'Supplier',
      supplier.id,
      { data },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(supplier, 'Supplier updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update supplier');
  }
}

// DELETE - Delete supplier
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_supplier')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return handleApiError(new Error('ID is required'), 'Delete supplier');
    }

    const linkedCount =
      (await prisma.purchaseOrder.count({ where: { supplierId: id } })) +
      (await prisma.purchaseInvoice.count({ where: { supplierId: id } }));
    if (linkedCount > 0) {
      return apiError('Cannot delete supplier with existing orders or invoices', 400);
    }

    await prisma.supplier.delete({
      where: { id },
    });

    await logAuditAction(
      user.id,
      'DELETE',
      'purchases',
      'Supplier',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Supplier deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete supplier');
  }
}
