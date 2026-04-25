import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { journalEntryRepo } from '@/lib/repositories/journal-entry.repo';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { createJournalEntry, postJournalEntry, reverseJournalEntry } from '@/lib/accounting';
import { dualRunCompare } from '@/lib/domain/accounting/dual-run';

// GET - Read journal entries
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);

    if (!user.tenantId) {
      return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    }

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId: user.tenantId,
    };

    if (fromDate || toDate) {
      where.entryDate = {};
      if (fromDate) where.entryDate.gte = new Date(fromDate);
      if (toDate) where.entryDate.lte = new Date(toDate + 'T23:59:59.999Z');
    }
    const { entries: data, total } = await journalEntryRepo.listByWhere(where, { skip, take: limit });

    return apiSuccess({ entries: data, total, page, limit }, 'Journal entries fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Fetch journal entries');
  }
}

// POST - Create manual journal entry
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'create_accounting')) return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);

    const body = await request.json();
    const { entryDate, description, referenceType, referenceId, lines, autoPost } = body;

    if (!entryDate || !description || !lines || !Array.isArray(lines) || lines.length === 0) {
      return apiError('Entry date, description, and lines are required', 400);
    }

    // Validate double-entry: debits must equal credits
    const totalDebit = lines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return apiError(`Double-entry violation: debits (${totalDebit}) must equal credits (${totalCredit})`, 400);
    }

    // Validate all lines have account codes
    for (const line of lines) {
      if (!line.accountCode) {
        return apiError('All lines must have an account code', 400);
      }

      // Verify account exists
      const account = await prisma.account.findUnique({
        where: { tenantId_code: { tenantId: user.tenantId!, code: line.accountCode } },
      });

      if (!account) {
        return apiError(`Account with code ${line.accountCode} not found`, 404);
      }

      if (!account.isActive) {
        return apiError(`Account ${line.accountCode} is inactive`, 400);
      }
    }

    // Create journal entry
    const journalEntry = await createJournalEntry({
      entryDate: new Date(entryDate),
      description,
      referenceType: referenceType || 'Manual',
      referenceId: referenceId || null,
      tenantId: user.tenantId!,
      lines: lines.map((line: any) => ({
        accountCode: line.accountCode,
        debit: line.debit || 0,
        credit: line.credit || 0,
        description: line.description || '',
      })),
    }, user.id);

    // Auto-post if requested
    if (autoPost) {
      await postJournalEntry(journalEntry.id, user.id);
    }

    // Phase 1 dual-run: validate against new domain engine (no behavior change)
    await dualRunCompare('JournalEntry:POST', journalEntry);

    const result = await prisma.journalEntry.findUnique({
      where: { id: journalEntry.id },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    await logAuditAction(
      user.id, 'CREATE', 'accounting', 'JournalEntry', journalEntry.id, { journalEntry: result },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(result, 'Journal entry created successfully');
  } catch (error) {
    return handleApiError(error, 'Create journal entry');
  }
}

// PUT - Update journal entry (only if not posted)
export async function PUT(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'update_accounting')) return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);

    const body = await request.json();
    const { id, entryDate, description, lines } = body;

    if (!id) {
      return apiError('Journal entry ID is required', 400);
    }

    // Check if entry exists
    const existingEntry = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!existingEntry) {
      return apiError('Journal entry not found', 404);
    }

    // Prevent modification if already posted
    if (existingEntry.isPosted) {
      return apiError('Cannot modify a posted journal entry', 400);
    }

    // Validate double-entry if lines are provided
    if (lines && Array.isArray(lines)) {
      const totalDebit = lines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0);
      const totalCredit = lines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return apiError(`Double-entry violation: debits (${totalDebit}) must equal credits (${totalCredit})`, 400);
      }

      // Delete existing lines and create new ones
      await prisma.$transaction([
        prisma.journalEntryLine.deleteMany({ where: { journalEntryId: id } }),
        prisma.journalEntry.update({
          where: { id },
          data: {
            entryDate: entryDate ? new Date(entryDate) : undefined,
            description: description || undefined,
            lines: {
              create: lines.map((line: any) => ({
                accountCode: line.accountCode,
                debit: line.debit || 0,
                credit: line.credit || 0,
                description: line.description || '',
                tenantId: user.tenantId!,
              })),
            },
          },
        }),
      ]);
    } else {
      // Just update basic fields
      await prisma.journalEntry.update({
        where: { id },
        data: {
          entryDate: entryDate ? new Date(entryDate) : undefined,
          description: description || undefined,
        },
      });
    }

    const result = await prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    await logAuditAction(
      user.id, 'UPDATE', 'accounting', 'JournalEntry', id, { journalEntry: result },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(result, 'Journal entry updated successfully');
  } catch (error) {
    return handleApiError(error, 'Update journal entry');
  }
}

// DELETE - Delete journal entry (only if not posted)
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'delete_accounting')) return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return apiError('Journal entry ID is required', 400);
    }

    // Check if entry exists
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return apiError('Journal entry not found', 404);
    }

    // Prevent deletion if already posted
    if (entry.isPosted) {
      return apiError('Cannot delete a posted journal entry', 400);
    }

    await prisma.$transaction([
      prisma.journalEntryLine.deleteMany({ where: { journalEntryId: id } }),
      prisma.journalEntry.delete({ where: { id } }),
    ]);

    await logAuditAction(
      user.id, 'DELETE', 'accounting', 'JournalEntry', id, undefined,
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess({ id }, 'Journal entry deleted successfully');
  } catch (error) {
    return handleApiError(error, 'Delete journal entry');
  }
}
