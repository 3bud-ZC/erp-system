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

    const units = await prisma.unit.findMany({ orderBy: { createdAt: 'desc' } });
    return apiSuccess(units, 'Units fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch units');
  }
}

function uniqueConflictMessage(error: any): string {
  const target: string[] = error?.meta?.target ?? [];
  if (target.includes('nameAr')) return 'اسم الوحدة مستخدم بالفعل';
  if (target.includes('code')) return 'كود الوحدة مستخدم بالفعل';
  return 'القيمة مستخدمة بالفعل';
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
    const code = body.code?.toString().trim();
    const nameAr = body.nameAr?.toString().trim();
    const nameEn = body.nameEn?.toString().trim() || null;

    if (!code) {
      return handleApiError(new Error('الكود مطلوب'), 'Create unit');
    }
    if (!nameAr) {
      return handleApiError(new Error('الاسم العربي مطلوب'), 'Create unit');
    }

    const unit = await prisma.unit.create({
      data: { code, nameAr, nameEn },
    });

    await logAuditAction(
      user.id,
      'CREATE',
      'inventory',
      'Unit',
      unit.id,
      { unit },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(unit, 'Unit created successfully');
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return handleApiError(new Error(uniqueConflictMessage(error)), 'Create unit');
    }
    return handleApiError(error, 'Create unit');
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
    const { id } = body;
    const code = body.code?.toString().trim();
    const nameAr = body.nameAr?.toString().trim();
    const nameEn = body.nameEn?.toString().trim() || null;

    if (!id) {
      return handleApiError(new Error('id مطلوب'), 'Update unit');
    }
    if (!code) {
      return handleApiError(new Error('الكود مطلوب'), 'Update unit');
    }
    if (!nameAr) {
      return handleApiError(new Error('الاسم العربي مطلوب'), 'Update unit');
    }

    const unit = await prisma.unit.update({
      where: { id },
      data: { code, nameAr, nameEn },
    });

    await logAuditAction(
      user.id,
      'UPDATE',
      'inventory',
      'Unit',
      unit.id,
      { data: { code, nameAr, nameEn } },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(unit, 'Unit updated successfully');
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return handleApiError(new Error(uniqueConflictMessage(error)), 'Update unit');
    }
    if (error?.code === 'P2025') {
      return handleApiError(new Error('الوحدة غير موجودة'), 'Update unit');
    }
    return handleApiError(error, 'Update unit');
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
      return handleApiError(new Error('id is required'), 'Delete unit');
    }

    const productCount = await prisma.product.count({ where: { unitId: id } });
    if (productCount > 0) {
      return apiError('Cannot delete unit assigned to products', 400);
    }

    await prisma.unit.delete({ where: { id } });

    await logAuditAction(
      user.id,
      'DELETE',
      'inventory',
      'Unit',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Unit deleted successfully');
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return handleApiError(new Error('Unit not found'), 'Delete unit');
    }
    return handleApiError(error, 'Delete unit');
  }
}
