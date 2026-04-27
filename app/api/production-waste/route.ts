import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/production-waste
 *  - List all waste records for the tenant.
 *  - Optional ?productId / ?productionOrderId filters.
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user)                                      return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'read_inventory'))   return apiError('ليس لديك صلاحية', 403);
    if (!user.tenantId)                             return apiError('لم يتم تعيين مستأجر', 400);

    const { searchParams } = new URL(request.url);
    const productId        = searchParams.get('productId');
    const productionOrderId = searchParams.get('productionOrderId');

    const where: any = { tenantId: user.tenantId };
    if (productId)         where.productId         = productId;
    if (productionOrderId) where.productionOrderId = productionOrderId;

    const wastes = await (prisma as any).productionWaste.findMany({
      where,
      include: {
        product:         true,
        productionOrder: { select: { id: true, orderNumber: true } },
      },
      orderBy: { date: 'desc' },
    });

    return apiSuccess(wastes, 'Production waste fetched');
  } catch (error) {
    return handleApiError(error, 'Fetch production waste');
  }
}

/**
 * POST /api/production-waste
 *  Body: { productId, quantity, date?, productionOrderId?, notes? }
 *
 *  Records a waste entry and decrements the product stock by `quantity`
 *  inside a single transaction. The matching `inventoryTransaction` row is
 *  written so reports can pick it up under "حركة المخزون".
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user)                                       return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);
    if (!user.tenantId)                              return apiError('لم يتم تعيين مستأجر', 400);
    const tenantId = user.tenantId;

    const body = await request.json();
    const { productId, quantity, date, productionOrderId, notes } = body;

    if (!productId)                  return apiError('المنتج مطلوب', 400);
    if (!quantity || Number(quantity) <= 0) return apiError('الكمية يجب أن تكون أكبر من صفر', 400);

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true, stock: true, nameAr: true },
    });
    if (!product) return apiError('المنتج غير موجود', 404);

    const waste = await prisma.$transaction(async (tx) => {
      const created = await (tx as any).productionWaste.create({
        data: {
          productId,
          quantity:          Number(quantity),
          date:              date ? new Date(date) : new Date(),
          productionOrderId: productionOrderId || null,
          notes:             notes || null,
          tenantId,
        },
        include: { product: true, productionOrder: true },
      });

      // Decrement stock + record an inventory transaction so it shows up in
      // "حركة المخزون" reports.
      await tx.product.update({
        where: { id: productId },
        data:  { stock: { decrement: Number(quantity) } },
      });
      await (tx as any).inventoryTransaction.create({
        data: {
          productId,
          type:          'waste',
          quantity:      -Number(quantity),
          referenceId:   created.id,
          referenceType: 'ProductionWaste',
          notes:         notes || `Production waste`,
          tenantId,
          date:          date ? new Date(date) : new Date(),
        },
      });

      return created;
    });

    await logAuditAction(
      user.id, 'CREATE', 'manufacturing', 'ProductionWaste', waste.id,
      { productId, quantity },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined,
    );

    return apiSuccess(waste, 'Production waste recorded');
  } catch (error) {
    return handleApiError(error, 'Create production waste');
  }
}

/**
 * DELETE /api/production-waste?id=...
 *  Reverses the stock decrement that was applied at creation time.
 */
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user)                                       return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_inventory')) return apiError('ليس لديك صلاحية', 403);
    if (!user.tenantId)                              return apiError('لم يتم تعيين مستأجر', 400);
    const tenantId = user.tenantId;

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return apiError('id مطلوب', 400);

    const waste = await (prisma as any).productionWaste.findFirst({
      where: { id, tenantId },
    });
    if (!waste) return apiError('سجل الفاقد غير موجود', 404);

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: waste.productId },
        data:  { stock: { increment: Number(waste.quantity) } },
      });
      await (tx as any).inventoryTransaction.create({
        data: {
          productId:     waste.productId,
          type:          'waste_reversal',
          quantity:      Number(waste.quantity),
          referenceId:   waste.id,
          referenceType: 'ProductionWaste',
          notes:         `Reversed waste record`,
          tenantId,
          date:          new Date(),
        },
      });
      await (tx as any).productionWaste.delete({ where: { id } });
    });

    await logAuditAction(
      user.id, 'DELETE', 'manufacturing', 'ProductionWaste', id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined,
    );

    return apiSuccess({ id }, 'Production waste deleted');
  } catch (error) {
    return handleApiError(error, 'Delete production waste');
  }
}
