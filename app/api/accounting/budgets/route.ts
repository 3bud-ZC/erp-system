import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { transitionEntity } from '@/lib/workflow-engine';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Read budgets
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

    const where: any = { tenantId: user.tenantId };
    if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);
    if (status) where.status = status;

    // @ts-ignore - Prisma client type issue
    const [data, total] = await Promise.all([
      (prisma as any).budget.findMany({
        // @ts-ignore - Prisma client type issue
        where,
        include: {
          entries: {
            include: {
              account: true,
            },
          },
        },
        orderBy: { fiscalYear: 'desc' },
        skip,
        take: limit,
      }),
      // @ts-ignore - Prisma client type issue
      (prisma as any).budget.count({ where }),
    ]);

    return apiSuccess({ budgets: data, total, page, limit }, 'Budgets fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch budgets');
  }
}

// POST - Create budget
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { name, fiscalYear, period, startDate, endDate, notes, entries } = body;

    if (!name || !fiscalYear || !period || !startDate || !endDate) {
      return apiError('Name, fiscal year, period, start date, and end date are required', 400);
    }

    if (!['annual', 'quarterly', 'monthly'].includes(period)) {
      return apiError('Period must be annual, quarterly, or monthly', 400);
    }

    // Generate budget code
    // @ts-ignore - Prisma client type issue
    const lastBudget = await (prisma as any).budget.findFirst({
      orderBy: { code: 'desc' },
    });
    const nextNumber = lastBudget ? parseInt(lastBudget.code.slice(3)) + 1 : 1;
    const code = `BGT-${String(nextNumber).padStart(6, '0')}`;

    // Create budget with entries
    const budget = await (prisma as any).budget.create({
      data: {
        code,
        name,
        fiscalYear: parseInt(fiscalYear),
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'draft',
        notes,
        tenantId: user.tenantId,
        entries: entries ? {
          create: entries.map((entry: any) => ({
            accountCode: entry.accountCode,
            budgetedAmount: entry.budgetedAmount,
            period: entry.period,
          })),
        } : undefined,
      },
      include: {
        entries: {
          include: {
            account: true,
          },
        },
      },
    });

    // Trigger workflow transition
    await transitionEntity('Budget', budget.id, 'draft', user.id, { fiscalYear: budget.fiscalYear });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'accounting', 'Budget', budget.id,
      { code: budget.code, name, fiscalYear: budget.fiscalYear },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(budget, 'Budget created successfully');
  } catch (error) {
    return handleApiError(error, 'Create budget');
  }
}

// PUT - Update budget (approve/activate/close)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id) {
      return apiError('Budget ID is required', 400);
    }

    // Check if budget exists and belongs to this tenant
    // @ts-ignore - Prisma client type issue
    const existingBudget = await (prisma as any).budget.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        entries: true,
      },
    });

    if (!existingBudget) {
      return apiError('Budget not found', 404);
    }

    // Update budget
    // @ts-ignore - Prisma client type issue
    const updated = await (prisma as any).budget.update({
      where: { id },
      data: {
        status: status || undefined,
        notes: notes || undefined,
      },
      include: {
        entries: {
          include: {
            account: true,
          },
        },
      },
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingBudget.status) {
      await transitionEntity('Budget', id, status, user.id, { status });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'accounting', 'Budget', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(updated, 'Budget updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update budget');
  }
}

// DELETE - Delete budget
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Budget ID is required', 400);
    }

    // Check if budget exists and belongs to this tenant
    const deleted = await (prisma as any).budget.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!deleted) {
      return apiError('Budget not found', 404);
    }

    // Prevent deletion if budget is active or closed
    if (deleted.status === 'active' || deleted.status === 'closed') {
      return apiError('Cannot delete an active or closed budget', 400);
    }

    await (prisma as any).budget.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'accounting', 'Budget', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Budget deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete budget');
  }
}
