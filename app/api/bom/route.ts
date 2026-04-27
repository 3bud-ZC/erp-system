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
    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    // BOMItem inherits its tenant via the related Product; we always scope
    // on `product.tenantId` to prevent cross-tenant reads.
    const where = productId
      ? { productId, product: { tenantId: user.tenantId } }
      : { product: { tenantId: user.tenantId } };

    const bom = await prisma.bOMItem.findMany({
      where,
      include: {
        product: true,
        material: true,
      },
      orderBy: { createdAt: 'desc' },
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

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const body = await request.json();
    const { productId, materialId, quantity } = body;

    // Both ends of a BOM row must belong to the caller's tenant. This stops
    // a tenant from grafting another tenant's product/material into their BOM.
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: user.tenantId },
    });
    if (!product) {
      return apiError('المنتج النهائي غير موجود', 404);
    }

    const material = await prisma.product.findFirst({
      where: { id: materialId, tenantId: user.tenantId },
    });
    if (!material) {
      return apiError('المادة الخام غير موجودة', 404);
    }

    if (productId === materialId) {
      return apiError('المنتج لا يمكن أن يكون مادة خام لنفسه', 400);
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
    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const body = await request.json();
    const { id, quantity } = body;

    // Tenant-scope the update by combining `id` with `product.tenantId`.
    const tenantOwned = await prisma.bOMItem.findFirst({
      where: { id, product: { tenantId: user.tenantId } },
      select: { id: true },
    });
    if (!tenantOwned) {
      return apiError('عنصر BOM غير موجود', 404);
    }

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
    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('معرف عنصر BOM مطلوب', 400);
    }

    // Verify the BOM row belongs to the caller's tenant before deleting.
    const tenantOwned = await prisma.bOMItem.findFirst({
      where: { id, product: { tenantId: user.tenantId } },
      select: { id: true },
    });
    if (!tenantOwned) {
      return apiError('عنصر BOM غير موجود', 404);
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
