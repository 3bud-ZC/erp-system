import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createExpenseEntry, postJournalEntry } from '@/lib/accounting';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';

// GET - Read expenses (requires accounting permission)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'view_accounting')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const expenses = await prisma.expense.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return apiSuccess(expenses);
  } catch (error) {
    return handleApiError(error, 'Fetch expenses');
  }
}

// POST - Create expense (requires accounting permission)
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'manage_accounts')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
      const { expenseType, ...data } = body;
      const expense = await prisma.expense.create({
        data: {
          ...data,
          date: new Date(body.date),
        },
      });

      const journalEntry = await createExpenseEntry(expense.id, expense.amount, expenseType || 'Operating');
      if (journalEntry) {
        await postJournalEntry(journalEntry.id);
      }

      await logAuditAction(
        user.id,
        'CREATE',
        'accounting',
        'Expense',
        expense.id,
        { expense },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(expense, 'Expense created successfully');
    } catch (error) {
      return handleApiError(error, 'Create expense');
    }
  }

// PUT - Update expense (requires accounting permission)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'manage_accounts')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const body = await request.json();
      const { id, expenseType, ...data } = body;
      const expense = await prisma.expense.update({
        where: { id },
        data: {
          ...data,
          date: new Date(data.date),
        },
      });

      const journalEntry = await createExpenseEntry(expense.id, expense.amount, expenseType || 'Operating');
      if (journalEntry) {
        await postJournalEntry(journalEntry.id);
      }

      await logAuditAction(
        user.id,
        'UPDATE',
        'accounting',
        'Expense',
        expense.id,
        { data },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess(expense, 'Expense updated successfully');
    } catch (error) {
      return handleApiError(error, 'Update expense');
    }
  }

// DELETE - Delete expense (requires accounting permission)
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    if (!checkPermission(user, 'manage_accounts')) {
      return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);
    }

    const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      
      if (!id) {
        return handleApiError(new Error('ID is required'), 'Delete expense');
      }

      await prisma.expense.delete({
        where: { id },
      });

      await logAuditAction(
        user.id,
        'DELETE',
        'accounting',
        'Expense',
        id,
        undefined,
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      return apiSuccess({ id }, 'Expense deleted successfully');
    } catch (error) {
      return handleApiError(error, 'Delete expense');
    }
  }
