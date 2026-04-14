import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read customers
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const customers = await prisma.customer.findMany({
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

    const body = await request.json();
    const customer = await prisma.customer.create({
      data: body,
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
  } catch (error) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiError('Customer ID is required', 400);

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
