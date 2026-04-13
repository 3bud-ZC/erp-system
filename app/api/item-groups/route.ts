import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser } from '@/lib/auth';

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
      prisma.itemGroup.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.itemGroup.count({ where }),
    ]);

    return apiSuccess({ data, total, page, limit });
  } catch (error) {
    return handleApiError(error, 'Fetch item groups');
  }
}

function uniqueConflictMessage(error: any): string {
  const target: string[] = error?.meta?.target ?? [];
  if (target.includes('nameAr')) return 'اسم المجموعة مستخدم بالفعل';
  if (target.includes('code')) return 'كود المجموعة مستخدم بالفعل';
  return 'القيمة مستخدمة بالفعل';
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const body = await request.json();
    const code = body.code?.toString().trim();
    const nameAr = body.nameAr?.toString().trim();
    const nameEn = body.nameEn?.toString().trim() || null;
    const description = body.description?.toString().trim() || null;

    if (!code) {
      return handleApiError(new Error('الكود مطلوب'), 'Create item group');
    }
    if (!nameAr) {
      return handleApiError(new Error('الاسم العربي مطلوب'), 'Create item group');
    }

    const group = await prisma.itemGroup.create({
      data: { code, nameAr, nameEn, description },
    });

    await logAuditAction(
      user.id,
      'CREATE',
      'inventory',
      'ItemGroup',
      group.id,
      { group },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(group, 'Item group created successfully');
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return handleApiError(new Error(uniqueConflictMessage(error)), 'Create item group');
    }
    return handleApiError(error, 'Create item group');
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const body = await request.json();
    const { id } = body;
    const code = body.code?.toString().trim();
    const nameAr = body.nameAr?.toString().trim();
    const nameEn = body.nameEn?.toString().trim() || null;
    const description = body.description?.toString().trim() || null;

    if (!id) {
      return handleApiError(new Error('id مطلوب'), 'Update item group');
    }
    if (!code) {
      return handleApiError(new Error('الكود مطلوب'), 'Update item group');
    }
    if (!nameAr) {
      return handleApiError(new Error('الاسم العربي مطلوب'), 'Update item group');
    }

    const group = await prisma.itemGroup.update({
      where: { id },
      data: { code, nameAr, nameEn, description },
    });

    await logAuditAction(
      user.id,
      'UPDATE',
      'inventory',
      'ItemGroup',
      group.id,
      { data: { code, nameAr, nameEn, description } },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(group, 'Item group updated successfully');
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return handleApiError(new Error(uniqueConflictMessage(error)), 'Update item group');
    }
    if (error?.code === 'P2025') {
      return handleApiError(new Error('المجموعة غير موجودة'), 'Update item group');
    }
    return handleApiError(error, 'Update item group');
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return handleApiError(new Error('id مطلوب'), 'Delete item group');
    }

    await prisma.itemGroup.delete({ where: { id } });

    await logAuditAction(
      user.id,
      'DELETE',
      'inventory',
      'ItemGroup',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Item group deleted successfully');
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return handleApiError(new Error('المجموعة غير موجودة'), 'Delete item group');
    }
    return handleApiError(error, 'Delete item group');
  }
}
