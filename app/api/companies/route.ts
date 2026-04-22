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

    const companies = await prisma.company.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' }
    });
    return apiSuccess(companies, 'Companies fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch companies');
  }
}

function uniqueConflictMessage(error: any): string {
  const target: string[] = error?.meta?.target ?? [];
  if (target.includes('nameAr')) return 'اسم الشركة مستخدم بالفعل';
  if (target.includes('code')) return 'كود الشركة مستخدم بالفعل';
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
    const address = body.address?.toString().trim() || null;
    const phone = body.phone?.toString().trim() || null;
    const email = body.email?.toString().trim() || null;
    const taxNumber = body.taxNumber?.toString().trim() || null;

    if (!code) {
      return handleApiError(new Error('الكود مطلوب'), 'Create company');
    }
    if (!nameAr) {
      return handleApiError(new Error('الاسم العربي مطلوب'), 'Create company');
    }

    // @ts-ignore - Prisma client type issue
    const company = await (prisma as any).company.create({
      data: { code, nameAr, nameEn, address, phone, email, taxNumber, tenantId: user.tenantId },
    });

    await logAuditAction(
      user.id,
      'CREATE',
      'inventory',
      'Company',
      company.id,
      { company },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(company, 'Company created successfully');
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return handleApiError(new Error(uniqueConflictMessage(error)), 'Create company');
    }
    return handleApiError(error, 'Create company');
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
    const address = body.address?.toString().trim() || null;
    const phone = body.phone?.toString().trim() || null;
    const email = body.email?.toString().trim() || null;
    const taxNumber = body.taxNumber?.toString().trim() || null;

    if (!id) {
      return handleApiError(new Error('id مطلوب'), 'Update company');
    }
    if (!code) {
      return handleApiError(new Error('الكود مطلوب'), 'Update company');
    }
    if (!nameAr) {
      return handleApiError(new Error('الاسم العربي مطلوب'), 'Update company');
    }

    const company = await prisma.company.update({
      where: { id },
      data: { code, nameAr, nameEn, address, phone, email, taxNumber },
    });

    await logAuditAction(
      user.id,
      'UPDATE',
      'inventory',
      'Company',
      company.id,
      { data: { code, nameAr, nameEn, address, phone, email, taxNumber } },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(company, 'Company updated successfully');
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return handleApiError(new Error(uniqueConflictMessage(error)), 'Update company');
    }
    if (error?.code === 'P2025') {
      return handleApiError(new Error('الشركة غير موجودة'), 'Update company');
    }
    return handleApiError(error, 'Update company');
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
      return handleApiError(new Error('id مطلوب'), 'Delete company');
    }

    const productCount = await prisma.product.count({ where: { companyId: id } });
    if (productCount > 0) {
      return apiError('Cannot delete company with assigned products', 400);
    }

    await prisma.company.delete({ where: { id } });

    await logAuditAction(
      user.id,
      'DELETE',
      'inventory',
      'Company',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Company deleted successfully');
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return handleApiError(new Error('الشركة غير موجودة'), 'Delete company');
    }
    return handleApiError(error, 'Delete company');
  }
}
