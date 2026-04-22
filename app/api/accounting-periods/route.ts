import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Read accounting periods
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const fiscalYear = searchParams.get('fiscalYear');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (fiscalYear) where.fiscalYearId = fiscalYear;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.accountingPeriod.findMany({
        where,
        orderBy: [{ startDate: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.accountingPeriod.count({ where }),
    ]);

    return apiSuccess({ periods: data, total, page, limit }, 'Accounting periods fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch accounting periods');
  }
}

// POST - Create accounting period
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { name, startDate, endDate, fiscalYear } = body;

    if (!name || !startDate || !endDate || !fiscalYear) {
      return apiError('Name, start date, end date, and fiscal year are required', 400);
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return apiError('Start date must be before end date', 400);
    }

    // Check for overlapping periods in the same fiscal year
    const overlappingPeriod = await prisma.accountingPeriod.findFirst({
      where: {
        fiscalYearId: fiscalYear,
        OR: [
          {
            startDate: { lte: start },
            endDate: { gte: start },
          },
          {
            startDate: { lte: end },
            endDate: { gte: end },
          },
          {
            startDate: { gte: start },
            endDate: { lte: end },
          },
        ],
      },
    });

    if (overlappingPeriod) {
      return apiError('Period overlaps with an existing period in the same fiscal year', 400);
    }

    // Create accounting period
    if (!user.tenantId) {
      return apiError('User tenant not found', 400);
    }
    const period = await prisma.accountingPeriod.create({
      data: {
        name,
        startDate: start,
        endDate: end,
        fiscalYearId: fiscalYear,
        status: 'open',
        isClosed: false,
        tenantId: user.tenantId,
      },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'accounting', 'AccountingPeriod', period.id,
      { name, fiscalYear, startDate, endDate },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(period, 'Accounting period created successfully');
  } catch (error) {
    return handleApiError(error, 'Create accounting period');
  }
}

// PUT - Update accounting period
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, name, startDate, endDate, status } = body;

    if (!id) {
      return apiError('Accounting period ID is required', 400);
    }

    // Check if period exists
    const existingPeriod = await prisma.accountingPeriod.findUnique({
      where: { id },
    });

    if (!existingPeriod) {
      return apiError('Accounting period not found', 404);
    }

    // Prevent modification if already closed
    if (existingPeriod.isClosed) {
      return apiError('Cannot modify a closed accounting period', 400);
    }

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start >= end) {
        return apiError('Start date must be before end date', 400);
      }

      // Check for overlapping periods
      const overlappingPeriod = await prisma.accountingPeriod.findFirst({
        where: {
          fiscalYearId: existingPeriod.fiscalYearId,
          id: { not: id },
          OR: [
            {
              startDate: { lte: start },
              endDate: { gte: start },
            },
            {
              startDate: { lte: end },
              endDate: { gte: end },
            },
            {
              startDate: { gte: start },
              endDate: { lte: end },
            },
          ],
        },
      });

      if (overlappingPeriod) {
        return apiError('Period overlaps with an existing period in the same fiscal year', 400);
      }
    }

    // Handle closing the period
    let updateData: any = {
      name: name || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status: status || undefined,
    };

    if (status === 'closed' && !existingPeriod.isClosed) {
      updateData.isClosed = true;
      updateData.closedAt = new Date();
      updateData.closedBy = user.id;
    }

    // Update period
    const period = await prisma.accountingPeriod.update({
      where: { id },
      data: updateData,
    });

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'accounting', 'AccountingPeriod', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(period, 'Accounting period updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update accounting period');
  }
}

// DELETE - Delete accounting period
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Accounting period ID is required', 400);
    }

    // Check if period exists
    const period = await prisma.accountingPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      return apiError('Accounting period not found', 404);
    }

    // Prevent deletion if already closed
    if (period.isClosed) {
      return apiError('Cannot delete a closed accounting period', 400);
    }

    await prisma.accountingPeriod.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'accounting', 'AccountingPeriod', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Accounting period deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete accounting period');
  }
}
