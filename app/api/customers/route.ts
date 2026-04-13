import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';

// GET - Read customers
export async function GET(request: Request) {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(customers);
  } catch (error) {
    return handleApiError(error, 'Fetch customers');
  }
}

// POST - Create customer
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customer = await prisma.customer.create({
      data: body,
    });
    return apiSuccess(customer, 'Customer created successfully');
  } catch (error) {
    return handleApiError(error, 'Create customer');
  }
}

// PUT - Update customer
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    const customer = await prisma.customer.update({
      where: { id },
      data,
    });
    return apiSuccess(customer, 'Customer updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update customer');
  }
}

// DELETE - Delete customer
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiError('Customer ID is required', 400);
    await prisma.customer.delete({ where: { id } });
    return apiSuccess({ id }, 'Customer deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete customer');
  }
}
