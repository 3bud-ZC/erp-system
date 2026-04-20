import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';

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

    const movements = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: {
          select: { code: true, nameAr: true }
        }
      },
      orderBy: { date: 'desc' }
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
      // Fetch existing movement for activity logging
      const existingMovement = await prisma.inventoryTransaction.findUnique({
        where: { id },
      });

      // Delete single movement
      await prisma.inventoryTransaction.delete({ where: { id } });

      // Log activity for audit trail
      await logActivity({
        entity: 'InventoryTransaction',
        entityId: id,
        action: 'DELETE',
        userId: user.id,
        before: existingMovement,
      });

      return apiSuccess({ id }, 'تم حذف حركة المخزن');
    }

    if (productId) {
      // Fetch existing movements for activity logging
      const existingMovements = await prisma.inventoryTransaction.findMany({
        where: { productId },
      });

      // Delete all movements for a product
      const result = await prisma.inventoryTransaction.deleteMany({
        where: { productId }
      });

      // Log activity for audit trail
      await logActivity({
        entity: 'InventoryTransaction',
        entityId: productId,
        action: 'DELETE',
        userId: user.id,
        before: existingMovements,
      });

      return apiSuccess({ count: result.count }, `تم حذف ${result.count} حركة مخزن للمنتج`);
    }

    return apiError('يرجى تحديد معرف الحركة أو المنتج', 400);
  } catch (error) {
    return handleApiError(error, 'Delete stock movements');
  }
}
