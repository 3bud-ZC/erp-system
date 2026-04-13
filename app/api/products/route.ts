import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read products
export async function GET(request: Request) {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        unitRef: true,
        company: true,
        itemGroup: true,
        warehouse: true,
      },
    });
    return apiSuccess({ products });
  } catch (error) {
    return handleApiError(error, 'Fetch products');
  }
}

// POST - Create product (requires create_product permission)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_product')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const product = await prisma.product.create({
      data: body,
    });

    // Log audit action
    await logAuditAction(
      user.id,
      'CREATE',
      'inventory',
      'Product',
      product.id,
      { product },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(product, 'Product created successfully');
  } catch (error) {
    return handleApiError(error, 'Create product');
  }
}

// PUT - Update product (requires update_product permission)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_product')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const { id, stock, ...data } = body;

    // SECURITY: Prevent direct stock manipulation via generic product endpoint
    // Stock must only be modified through inventory operations (invoices, adjustments, etc.)
    if (stock !== undefined) {
      return handleApiError(
        new Error('Cannot modify stock directly. Use inventory operations (invoices, adjustments).'),
        'Update product'
      );
    }

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    // Log audit action
    await logAuditAction(
      user.id,
      'UPDATE',
      'inventory',
      'Product',
      product.id,
      { data },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(product, 'Product updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update product');
  }
}

// DELETE - Delete product (requires delete_product permission)
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_product')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return handleApiError(new Error('ID is required'), 'Delete product');
    }

    await prisma.product.delete({
      where: { id },
    });

    // Log audit action
    await logAuditAction(
      user.id,
      'DELETE',
      'inventory',
      'Product',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Product deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete product');
  }
}

