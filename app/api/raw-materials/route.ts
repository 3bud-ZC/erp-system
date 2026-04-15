import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Read raw materials
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const materials = await prisma.product.findMany({
      where: { type: 'raw_material' },
      orderBy: { createdAt: 'desc' },
    });
    
    return apiSuccess(materials, 'Raw materials fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch raw materials');
  }
}

// POST - Create raw material
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const body = await request.json();
    const { code, nameAr, nameEn, unit, cost, stock, minStock, category, description } = body;

    if (!code || !nameAr || !unit) {
      return apiError('الكود والاسم والوحدة مطلوبة', 400);
    }

    // Check for duplicate code
    const existing = await prisma.product.findUnique({
      where: { code },
    });

    if (existing) {
      return apiError('الكود موجود بالفعل', 400);
    }

    const material = await prisma.product.create({
      data: {
        code,
        nameAr,
        nameEn: nameEn || null,
        type: 'raw_material',
        unit,
        price: 0,
        cost: parseFloat(cost) || 0,
        stock: parseFloat(stock) || 0,
        minStock: parseFloat(minStock) || 0,
      },
    });

    return apiSuccess(material, 'تم إنشاء المادة الخام بنجاح');
  } catch (error) {
    return handleApiError(error, 'Create raw material');
  }
}

// PUT - Update raw material
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const body = await request.json();
    const { id, code, nameAr, nameEn, unit, cost, stock, minStock, category, description } = body;

    if (!id) {
      return apiError('معرف المادة الخام مطلوب', 400);
    }

    // Check if code is being changed and if new code already exists
    if (code) {
      const existing = await prisma.product.findFirst({
        where: {
          code,
          NOT: { id },
        },
      });

      if (existing) {
        return apiError('الكود موجود بالفعل', 400);
      }
    }

    const material = await prisma.product.update({
      where: { id },
      data: {
        ...(code && { code }),
        ...(nameAr && { nameAr }),
        ...(nameEn !== undefined && { nameEn: nameEn || null }),
        ...(unit && { unit }),
        ...(cost !== undefined && { cost: parseFloat(cost) }),
        ...(stock !== undefined && { stock: parseFloat(stock) }),
        ...(minStock !== undefined && { minStock: parseFloat(minStock) }),
      },
    });

    return apiSuccess(material, 'تم تحديث المادة الخام بنجاح');
  } catch (error) {
    return handleApiError(error, 'Update raw material');
  }
}

// DELETE - Delete raw material
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('معرف المادة الخام مطلوب', 400);
    }

    // Check if material is used in any BOM
    const bomCount = await prisma.bOMItem.count({
      where: { materialId: id },
    });

    if (bomCount > 0) {
      return apiError('لا يمكن حذف المادة الخام لأنها مستخدمة في قوائم المواد', 400);
    }

    await prisma.product.delete({
      where: { id },
    });

    return apiSuccess(null, 'تم حذف المادة الخام بنجاح');
  } catch (error) {
    return handleApiError(error, 'Delete raw material');
  }
}
