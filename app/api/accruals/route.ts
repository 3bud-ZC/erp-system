import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { createJournalEntry, postJournalEntry } from '@/lib/accounting';
import { transitionEntity } from '@/lib/workflow-engine';
import { registerAllEventHandlers } from '@/lib/event-handlers';

// Register event handlers on module load
registerAllEventHandlers();

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Read accruals
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // accrued_expense, deferred_revenue
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      (prisma as any).accrual.findMany({
        where,
        include: {
          journalEntry: true,
        },
        orderBy: { periodStartDate: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).accrual.count({ where }),
    ]);

    return apiSuccess({ accruals: data, total, page, limit }, 'Accruals fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch accruals');
  }
}

// POST - Create accrual
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { type, accountCode, amount, periodStartDate, periodEndDate, description, notes } = body;

    if (!type || !accountCode || !amount || !periodStartDate || !periodEndDate) {
      return apiError('Type, account code, amount, and period dates are required', 400);
    }

    if (!['accrued_expense', 'deferred_revenue'].includes(type)) {
      return apiError('Type must be either accrued_expense or deferred_revenue', 400);
    }

    // Validate account
    const account = await prisma.account.findUnique({
      where: { tenantId_code: { tenantId: user.tenantId!, code: accountCode } },
    });

    if (!account) {
      return apiError('Account not found', 404);
    }

    // Generate accrual number
    const lastAccrual = await (prisma as any).accrual.findFirst({
      orderBy: { accrualNumber: 'desc' },
    });
    const nextNumber = lastAccrual ? parseInt(lastAccrual.accrualNumber.slice(3)) + 1 : 1;
    const accrualNumber = `ACR-${String(nextNumber).padStart(6, '0')}`;

    // Create journal entry for the accrual
    const journalEntry = await createJournalEntry({
      entryDate: new Date(),
      description: description || `${type === 'accrued_expense' ? 'Accrued Expense' : 'Deferred Revenue'} ${accrualNumber}`,
      referenceType: 'Accrual',
      referenceId: accrualNumber,
      lines: type === 'accrued_expense' ? [
        {
          accountCode: accountCode, // Expense account
          debit: amount,
          credit: 0,
          description: `Accrued expense for period ${periodStartDate} to ${periodEndDate}`,
        },
        {
          accountCode: '2010', // Accrued Expenses Liability
          debit: 0,
          credit: amount,
          description: `Accrued expenses liability`,
        },
      ] : [
        {
          accountCode: '1020', // Cash or Accounts Receivable
          debit: amount,
          credit: 0,
          description: `Deferred revenue received`,
        },
        {
          accountCode: '2050', // Deferred Revenue Liability
          debit: 0,
          credit: amount,
          description: `Deferred revenue for period ${periodStartDate} to ${periodEndDate}`,
        },
      ],
    }, user.id);

    await postJournalEntry(journalEntry.id, user.id);

    // Create accrual
    const accrual = await (prisma as any).accrual.create({
      data: {
        accrualNumber,
        type,
        accountCode,
        amount,
        periodStartDate: new Date(periodStartDate),
        periodEndDate: new Date(periodEndDate),
        status: 'pending',
        journalEntryId: journalEntry.id,
        description,
        notes,
      },
      include: {
        journalEntry: true,
      },
    });

    // Trigger workflow transition
    await transitionEntity('Accrual', accrual.id, 'pending', user.id, { type, amount });

    // Audit logging
    await logAuditAction(
      user.id, 'CREATE', 'accounting', 'Accrual', accrual.id,
      { accrualNumber: accrual.accrualNumber, type, amount },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(accrual, 'Accrual created successfully');
  } catch (error) {
    return handleApiError(error, 'Create accrual');
  }
}

// PUT - Update accrual (recognize or reverse)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id) {
      return apiError('Accrual ID is required', 400);
    }

    // Check if accrual exists
    const existingAccrual = await (prisma as any).accrual.findUnique({
      where: { id },
      include: {
        journalEntry: true,
      },
    });

    if (!existingAccrual) {
      return apiError('Accrual not found', 404);
    }

    // Handle recognition (reversing the original entry)
    if (status === 'recognized' && existingAccrual.status !== 'recognized') {
      // Create reversing journal entry
      const reversingEntry = await createJournalEntry({
        entryDate: new Date(),
        description: `Reversing ${existingAccrual.type} ${existingAccrual.accrualNumber}`,
        referenceType: 'Accrual',
        referenceId: existingAccrual.id,
        lines: existingAccrual.journalEntry.lines.map((line: any) => ({
          accountCode: line.accountCode,
          debit: parseFloat(line.credit.toString()),
          credit: parseFloat(line.debit.toString()),
          description: `Reversing ${line.description || ''}`,
        })),
      }, user.id);

      await postJournalEntry(reversingEntry.id, user.id);

      // Update accrual
      const accrual = await (prisma as any).accrual.update({
        where: { id },
        data: {
          status: 'recognized',
          recognizedDate: new Date(),
          notes: notes || existingAccrual.notes,
        },
        include: {
          journalEntry: true,
        },
      });

      // Trigger workflow transition
      await transitionEntity('Accrual', id, 'recognized', user.id, { recognizedDate: new Date() });

      // Audit logging
      await logAuditAction(
        user.id, 'RECOGNIZE', 'accounting', 'Accrual', id,
        { accrualNumber: existingAccrual.accrualNumber },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(accrual, 'Accrual recognized successfully');
    }

    // Regular update
    const accrual = await prisma.accrual.update({
      where: { id },
      data: {
        status: status || undefined,
        notes: notes || undefined,
      },
      include: {
        journalEntry: true,
      },
    });

    // Trigger workflow transition if status changed
    if (status && status !== existingAccrual.status) {
      await transitionEntity('Accrual', id, status, user.id, { status });
    }

    // Audit logging
    await logAuditAction(
      user.id, 'UPDATE', 'accounting', 'Accrual', id,
      { body },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(accrual, 'Accrual updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update accrual');
  }
}

// DELETE - Delete accrual
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Accrual ID is required', 400);
    }

    // Check if accrual exists
    const accrual = await (prisma as any).accrual.findUnique({
      where: { id },
    });

    if (!accrual) {
      return apiError('Accrual not found', 404);
    }

    // Prevent deletion if already recognized
    if (accrual.status === 'recognized' || accrual.status === 'reversed') {
      return apiError('Cannot delete a recognized or reversed accrual', 400);
    }

    await (prisma as any).accrual.delete({
      where: { id },
    });

    // Audit logging
    await logAuditAction(
      user.id, 'DELETE', 'accounting', 'Accrual', id,
      {},
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Accrual deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete accrual');
  }
}
