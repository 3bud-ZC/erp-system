import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      const allBOMs = await prisma.bOMItem.findMany({
        include: {
          product: true,
          material: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return apiSuccess(allBOMs, 'BOM items fetched successfully');
    }

    const bom = await prisma.bOMItem.findMany({
      where: { productId },
      include: {
        product: true,
        material: true,
      },
    });

    return apiSuccess(bom, 'BOM items fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch BOM');
  }
}

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
    const { productId, materialId, quantity } = body;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return apiError('Product not found', 404);
    }

    const material = await prisma.product.findUnique({
      where: { id: materialId },
    });

    if (!material) {
      return apiError('Material product not found', 404);
    }

    if (productId === materialId) {
      return apiError('A product cannot be its own raw material', 400);
    }

    const existing = await prisma.bOMItem.findFirst({
      where: { productId, materialId },
    });

    if (existing) {
      const updated = await prisma.bOMItem.update({
        where: { id: existing.id },
        data: { quantity },
        include: { product: true, material: true },
      });

      await logAuditAction(
        user.id,
        'UPDATE',
        'manufacturing',
        'BOMItem',
        updated.id,
        { quantity },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(updated, 'BOM item updated successfully');
    }

    const bomItem = await prisma.bOMItem.create({
      data: {
        productId,
        materialId,
        quantity,
      },
      include: {
        product: true,
        material: true,
      },
    });

    await logAuditAction(
      user.id,
      'CREATE',
      'manufacturing',
      'BOMItem',
      bomItem.id,
      { bomItem },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(bomItem, 'BOM item created successfully');
  } catch (error) {
    return handleApiError(error, 'Create BOM item');
  }
}

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
    const { id, quantity } = body;

    const bomItem = await prisma.bOMItem.update({
      where: { id },
      data: { quantity },
      include: { product: true, material: true },
    });

    await logAuditAction(
      user.id,
      'UPDATE',
      'manufacturing',
      'BOMItem',
      bomItem.id,
      { quantity },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(bomItem, 'BOM item updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update BOM item');
  }
}

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
      return handleApiError(new Error('ID is required'), 'Delete BOM item');
    }

    await prisma.bOMItem.delete({
      where: { id },
    });

    await logAuditAction(
      user.id,
      'DELETE',
      'manufacturing',
      'BOMItem',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'BOM item deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete BOM item');
  }
}
