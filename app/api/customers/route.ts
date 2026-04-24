import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read customers
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const customers = await prisma.customer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return apiSuccess(customers, 'Customers fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch customers');
  }
}

// POST - Create customer
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'create_customer')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    
    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }
    
    // Remove tenantId from body if present - will be set from user context
    const { tenantId, ...customerData } = body;
    
    const customer = await prisma.customer.create({
      data: { 
        code: customerData.code,
        nameAr: customerData.nameAr,
        nameEn: customerData.nameEn,
        email: customerData.email,
        phone: customerData.phone,
        address: customerData.address,
        creditLimit: customerData.creditLimit,
        taxNumber: customerData.taxNumber,
        tenantId: user.tenantId
      },
    });

    await logAuditAction(
      user.id,
      'CREATE',
      'sales',
      'Customer',
      customer.id,
      { customer },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(customer, 'Customer created successfully');
  } catch (error: any) {
    console.error('Create customer error:', error);
    return handleApiError(error, 'Create customer');
  }
}

// PUT - Update customer
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'update_customer')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
    const { id, ...data } = body;
    const customer = await prisma.customer.update({
      where: { id },
      data,
    });

    await logAuditAction(
      user.id,
      'UPDATE',
      'sales',
      'Customer',
      customer.id,
      { data },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(customer, 'Customer updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update customer');
  }
}

// DELETE - Delete customer
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'delete_customer')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiError('Customer ID is required', 400);

    const linkedCount =
      (await prisma.salesOrder.count({ where: { customerId: id } })) +
      (await prisma.salesInvoice.count({ where: { customerId: id } }));
    if (linkedCount > 0) {
      return apiError('Cannot delete customer with existing orders or invoices', 400);
    }

    await prisma.customer.delete({ where: { id } });

    await logAuditAction(
      user.id,
      'DELETE',
      'sales',
      'Customer',
      id,
      undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Customer deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete customer');
  }
}
