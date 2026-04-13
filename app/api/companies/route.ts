import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const companies = await prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(companies);
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

    const company = await prisma.company.create({
      data: { code, nameAr, nameEn, address, phone, email, taxNumber },
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return handleApiError(new Error('id مطلوب'), 'Delete company');
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
