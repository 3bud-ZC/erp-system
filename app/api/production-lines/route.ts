import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Fetch all production lines
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'read_production_order')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status');

    if (id) {
      const line = await (prisma as any).productionLine.findUnique({
        where: { id },
        include: {
          assignments: {
            include: {
              product: true,
            },
          },
          productionOrders: {
            where: {
              status: { in: ['pending', 'in_progress'] },
            },
            include: {
              product: true,
            },
          },
        },
      });

      if (!line) {
        return apiError('خط الإنتاج غير موجود', 404);
      }

      return apiSuccess(line, 'Production line fetched');
    }

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const lines = await (prisma as any).productionLine.findMany({
      where,
      include: {
        assignments: {
          include: {
            product: true,
          },
        },
        productionOrders: {
          where: {
            status: { in: ['pending', 'in_progress'] },
          },
          include: {
            product: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return apiSuccess(lines, 'Production lines fetched');
  } catch (error) {
    return handleApiError(error, 'Fetch production lines');
  }
}

// POST - Create new production line
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_production_order')) {
      return apiError('ليس لديك صلاحية لإنشاء خط إنتاج', 403);
    }

    const body = await request.json();
    const { name, code, capacityPerHour, description, status = 'active' } = body;

    if (!name || !code) {
      return apiError('اسم خط الإنتاج والكود مطلوبان', 400);
    }

    // Check for duplicate code
    const existing = await (prisma as any).productionLine.findUnique({
      where: { code },
    });

    if (existing) {
      return apiError('كود خط الإنتاج مستخدم بالفعل', 400);
    }

    const line = await (prisma as any).productionLine.create({
      data: {
        name,
        code: code.toUpperCase(),
        capacityPerHour: capacityPerHour || 0,
        description,
        status,
      },
    });

    await logAuditAction(
      user.id,
      'CREATE',
      'manufacturing',
      'ProductionLine',
      line.id,
      { line },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(line, 'تم إنشاء خط الإنتاج بنجاح');
  } catch (error) {
    return handleApiError(error, 'Create production line');
  }
}

// PUT - Update production line
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_production_order')) {
      return apiError('ليس لديك صلاحية لتعديل خط إنتاج', 403);
    }

    const body = await request.json();
    const { id, name, capacityPerHour, description, status } = body;

    if (!id) {
      return apiError('معرف خط الإنتاج مطلوب', 400);
    }

    const line = await (prisma as any).productionLine.update({
      where: { id },
      data: {
        name,
        capacityPerHour,
        description,
        status,
      },
    });

    await logAuditAction(
      user.id,
      'UPDATE',
      'manufacturing',
      'ProductionLine',
      line.id,
      { updateData: { name, capacityPerHour, description, status } },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(line, 'تم تحديث خط الإنتاج بنجاح');
  } catch (error) {
    return handleApiError(error, 'Update production line');
  }
}

// DELETE - Delete production line
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_production_order')) {
      return apiError('ليس لديك صلاحية لحذف خط إنتاج', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('معرف خط الإنتاج مطلوب', 400);
    }

    // Check if line has active orders
    const line = await (prisma as any).productionLine.findUnique({
      where: { id },
      include: {
        productionOrders: {
          where: {
            status: { in: ['pending', 'in_progress'] },
          },
        },
      },
    });

    if (!line) {
      return apiError('خط الإنتاج غير موجود', 404);
    }

    if (line.productionOrders.length > 0) {
      return apiError('لا يمكن حذف خط الإنتاج لأنه يحتوي على أوامر إنتاج نشطة', 400);
    }

    await (prisma as any).productionLine.delete({
      where: { id },
    });

    await logAuditAction(
      user.id,
      'DELETE',
      'manufacturing',
      'ProductionLine',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'تم حذف خط الإنتاج بنجاح');
  } catch (error) {
    return handleApiError(error, 'Delete production line');
  }
}
