import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { nameAr: { contains: search, mode: 'insensitive' as const } },
            { nameEn: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      prisma.warehouse.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.warehouse.count({ where }),
    ]);

    return apiSuccess(data, 'Warehouses fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch warehouses');
  }
}

function uniqueConflictMessage(error: any): string {
  const target: string[] = error?.meta?.target ?? [];
  if (target.includes('nameAr')) return 'اسم المخزن مستخدم بالفعل';
  if (target.includes('code')) return 'كود المخزن مستخدم بالفعل';
  return 'القيمة مستخدمة بالفعل';
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_warehouse')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const code = body.code?.toString().trim();
    const nameAr = body.nameAr?.toString().trim();
    const nameEn = body.nameEn?.toString().trim() || null;
    const address = body.address?.toString().trim() || null;
    const phone = body.phone?.toString().trim() || null;
    const manager = body.manager?.toString().trim() || null;

    if (!code) {
      return handleApiError(new Error('الكود مطلوب'), 'Create warehouse');
    }
    if (!nameAr) {
      return handleApiError(new Error('الاسم العربي مطلوب'), 'Create warehouse');
    }

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const warehouse = await prisma.warehouse.create({
      data: { code, nameAr, nameEn, address, phone, manager, tenantId: user.tenantId },
    });

    await logAuditAction(
      user.id,
      'CREATE',
      'inventory',
      'Warehouse',
      warehouse.id,
      { warehouse },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(warehouse, 'Warehouse created successfully');
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return handleApiError(new Error(uniqueConflictMessage(error)), 'Create warehouse');
    }
    return handleApiError(error, 'Create warehouse');
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_warehouse')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const { id } = body;
    const code = body.code?.toString().trim();
    const nameAr = body.nameAr?.toString().trim();
    const nameEn = body.nameEn?.toString().trim() || null;
    const address = body.address?.toString().trim() || null;
    const phone = body.phone?.toString().trim() || null;
    const manager = body.manager?.toString().trim() || null;

    if (!id) {
      return handleApiError(new Error('id مطلوب'), 'Update warehouse');
    }
    if (!code) {
      return handleApiError(new Error('الكود مطلوب'), 'Update warehouse');
    }
    if (!nameAr) {
      return handleApiError(new Error('الاسم العربي مطلوب'), 'Update warehouse');
    }

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: { code, nameAr, nameEn, address, phone, manager },
    });

    await logAuditAction(
      user.id,
      'UPDATE',
      'inventory',
      'Warehouse',
      warehouse.id,
      { data: { code, nameAr, nameEn, address, phone, manager } },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(warehouse, 'Warehouse updated successfully');
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return handleApiError(new Error(uniqueConflictMessage(error)), 'Update warehouse');
    }
    if (error?.code === 'P2025') {
      return handleApiError(new Error('المخزن غير موجود'), 'Update warehouse');
    }
    return handleApiError(error, 'Update warehouse');
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_warehouse')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return handleApiError(new Error('id مطلوب'), 'Delete warehouse');
    }

    const productCount = await prisma.product.count({ where: { warehouseId: id } });
    if (productCount > 0) {
      return apiError('Cannot delete warehouse with assigned products', 400);
    }

    await prisma.warehouse.delete({ where: { id } });

    await logAuditAction(
      user.id,
      'DELETE',
      'inventory',
      'Warehouse',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Warehouse deleted successfully');
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return handleApiError(new Error('المخزن غير موجود'), 'Delete warehouse');
    }
    return handleApiError(error, 'Delete warehouse');
  }
}
