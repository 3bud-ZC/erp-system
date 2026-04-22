import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { reverseJournalEntry } from '@/lib/accounting';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Reverse a journal entry
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'reverse_accounting')) return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);

    const { id } = params;
    const body = await request.json();
    const { reversalDate, reversalDescription } = body;

    // Check if entry exists
    const entry = await (prisma as any).journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!entry) {
      return apiError('Journal entry not found', 404);
    }

    // Prevent reversal if not posted
    if (!entry.isPosted) {
      return apiError('Cannot reverse an unposted journal entry', 400);
    }

    const reversedEntry = await reverseJournalEntry(id);

    await logAuditAction(
      user.id, 'REVERSE', 'accounting', 'JournalEntry', id, { originalEntry: entry, reversedEntryId: reversedEntry.id },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(reversedEntry, 'Journal entry reversed successfully');
  } catch (error) {
    return handleApiError(error, 'Reverse journal entry');
  }
}
