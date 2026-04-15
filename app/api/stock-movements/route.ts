import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - List stock movements for a product
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'view_products')) {
      return apiError('ليس لديك صلاحية', 403);
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    const where = productId ? { productId } : {};

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: { code: true, nameAr: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return apiSuccess(movements, 'تم جلب حركات المخزن');
  } catch (error) {
    return handleApiError(error, 'Get stock movements');
  }
}

// DELETE - Delete stock movements (admin only - for cleanup)
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    // Only admins can delete stock movements
    if (!checkPermission(user, 'delete_product')) {
      return apiError('ليس لديك صلاحية حذف حركات المخزن', 403);
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const id = searchParams.get('id');

    if (id) {
      // Delete single movement
      await prisma.stockMovement.delete({ where: { id } });
      return apiSuccess({ id }, 'تم حذف حركة المخزن');
    }

    if (productId) {
      // Delete all movements for a product
      const result = await prisma.stockMovement.deleteMany({
        where: { productId }
      });
      return apiSuccess({ count: result.count }, `تم حذف ${result.count} حركة مخزن للمنتج`);
    }

    return apiError('يرجى تحديد معرف الحركة أو المنتج', 400);
  } catch (error) {
    return handleApiError(error, 'Delete stock movements');
  }
}
