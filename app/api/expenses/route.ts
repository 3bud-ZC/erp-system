import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { createExpenseEntry, postJournalEntry, reverseJournalEntry } from '@/lib/accounting';
import { dualRunCompare } from '@/lib/domain/accounting/dual-run';
import { expenseRepo } from '@/lib/repositories/expense.repo';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { logAuditAction, getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity-log';

// GET - Read expenses
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return apiError('لم يتم المصادقة', 401);
    }

    const expenses = await expenseRepo.listAll();
    return apiSuccess(expenses, 'Expenses fetched successfully');
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
      const { expenseType } = body;
      const expense = await prisma.$transaction(async (tx) => {
        const newExpense = await (tx as any).expense.create({
          data: {
            expenseNumber: body.expenseNumber,
            category: body.category || '',
            description: body.description || '',
            amount: body.amount || 0,
            tax: body.tax || 0,
            total: body.total || 0,
            date: new Date(body.date),
            notes: body.notes || null,
            supplierId: body.supplierId || null,
            branch: body.branch || null,
            taxNumber: body.taxNumber || null,
            invoiceNumber: body.invoiceNumber || null,
            status: body.status || 'pending',
            costCenter: body.costCenter || null,
            accountNumber: body.accountNumber || null,
            tenantId: user.tenantId,
          },
        });

        return newExpense;
      });

      // Create and post accounting journal entry (DR Expense / CR Cash)
      const journalEntry = await createExpenseEntry(expense.id, expense.amount, expenseType || 'other');
      if (journalEntry) {
        await postJournalEntry(journalEntry.id);
        // Phase 1 dual-run: validate against new domain engine (no behavior change)
        await dualRunCompare('Expense:POST', journalEntry);
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

      // Log activity for audit trail
      await logActivity({
        entity: 'Expense',
        entityId: expense.id,
        action: 'CREATE',
        userId: user.id,
        after: expense,
      });

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
      const { id, expenseType } = body;

      // STEP 1: Fetch existing expense for activity logging
      const existingExpense = await expenseRepo.findById(id);

      // STEP 2: Reverse existing journal entry for this expense (if any)
      const existingEntry = await prisma.journalEntry.findFirst({
        where: { referenceType: 'Expense', referenceId: id },
      });
      if (existingEntry) {
        await reverseJournalEntry(existingEntry.id);
      }

      // STEP 3: Update the expense
      const expense = await prisma.expense.update({
        where: { id },
        data: {
          expenseNumber: body.expenseNumber,
          category: body.category || '',
          description: body.description || '',
          amount: body.amount || 0,
          tax: body.tax || 0,
          total: body.total || 0,
          date: new Date(body.date),
          notes: body.notes || null,
          supplierId: body.supplierId || null,
          branch: body.branch || null,
          taxNumber: body.taxNumber || null,
          invoiceNumber: body.invoiceNumber || null,
          status: body.status || 'pending',
          costCenter: body.costCenter || null,
          accountNumber: body.accountNumber || null,
        },
      });

      // STEP 3: Create and post new journal entry with updated amount
      const journalEntry = await createExpenseEntry(expense.id, expense.amount, expenseType || 'other');
      if (journalEntry) {
        await postJournalEntry(journalEntry.id);
        // Phase 1 dual-run: validate against new domain engine (no behavior change)
        await dualRunCompare('Expense:PUT', journalEntry);
      }

      await logAuditAction(
        user.id,
        'UPDATE',
        'accounting',
        'Expense',
        expense.id,
        { expense },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );

      // Log activity for audit trail
      await logActivity({
        entity: 'Expense',
        entityId: expense.id,
        action: 'UPDATE',
        userId: user.id,
        before: existingExpense,
        after: expense,
      });

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

      // STEP 1: Fetch existing expense for activity logging
      const existingExpense = await expenseRepo.findById(id);

      // STEP 2: Reverse journal entry to restore account balances
      const existingEntry = await prisma.journalEntry.findFirst({
        where: { referenceType: 'Expense', referenceId: id },
      });
      if (existingEntry) {
        await reverseJournalEntry(existingEntry.id);
      }

      // STEP 3: Delete expense
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

      // Log activity for audit trail
      await logActivity({
        entity: 'Expense',
        entityId: id,
        action: 'DELETE',
        userId: user.id,
        before: existingExpense,
      });

      return apiSuccess({ id }, 'Expense deleted successfully');
    } catch (error) {
      return handleApiError(error, 'Delete expense');
    }
  }
