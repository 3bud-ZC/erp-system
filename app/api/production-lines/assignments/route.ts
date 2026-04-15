import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Fetch all assignments
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get('lineId');
    const productId = searchParams.get('productId');

    const where: any = {};
    if (lineId) where.productionLineId = lineId;
    if (productId) where.productId = productId;

    const assignments = await prisma.productionLineAssignment.findMany({
      where,
      include: {
        productionLine: true,
        product: true,
      },
      orderBy: { priority: 'desc' },
    });

    return apiSuccess(assignments, 'Assignments fetched');
  } catch (error) {
    return handleApiError(error, 'Fetch assignments');
  }
}

// POST - Create new assignment
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_production_order')) {
      return apiError('ليس لديك صلاحية', 403);
    }

    const body = await request.json();
    const { productionLineId, productId, priority = 0, notes } = body;

    if (!productionLineId || !productId) {
      return apiError('خط الإنتاج والمنتج مطلوبان', 400);
    }

    // Check if assignment already exists
    const existing = await prisma.productionLineAssignment.findUnique({
      where: {
        productionLineId_productId: {
          productionLineId,
          productId,
        },
      },
    });

    if (existing) {
      return apiError('هذا المنتج مخصص بالفعل لخط الإنتاج', 400);
    }

    const assignment = await prisma.productionLineAssignment.create({
      data: {
        productionLineId,
        productId,
        priority,
        notes,
      },
      include: {
        productionLine: true,
        product: true,
      },
    });

    await logAuditAction(
      user.id,
      'CREATE',
      'manufacturing',
      'ProductionLineAssignment',
      assignment.id,
      { assignment },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(assignment, 'تم تخصيص المنتج لخط الإنتاج');
  } catch (error) {
    return handleApiError(error, 'Create assignment');
  }
}

// DELETE - Remove assignment
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_production_order')) {
      return apiError('ليس لديك صلاحية', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('معرف التخصيص مطلوب', 400);
    }

    await prisma.productionLineAssignment.delete({
      where: { id },
    });

    await logAuditAction(
      user.id,
      'DELETE',
      'manufacturing',
      'ProductionLineAssignment',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'تم إلغاء تخصيص المنتج');
  } catch (error) {
    return handleApiError(error, 'Delete assignment');
  }
}
