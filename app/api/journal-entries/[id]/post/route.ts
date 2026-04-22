import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission, logAuditAction } from '@/lib/auth';
import { postJournalEntry } from '@/lib/accounting';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// POST - Post a journal entry
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'post_accounting')) return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);

    const { id } = params;

    // Check if entry exists
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return apiError('Journal entry not found', 404);
    }

    // Prevent posting if already posted
    if (entry.isPosted) {
      return apiError('Journal entry is already posted', 400);
    }

    await postJournalEntry(id, user.id);

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
      user.id, 'POST', 'accounting', 'JournalEntry', id, { journalEntry: result },
      request.headers.get('x-forwarded-for') || undefined,
      request.headers.get('user-agent') || undefined
    );

    return apiSuccess(result, 'Journal entry posted successfully');
  } catch (error) {
    return handleApiError(error, 'Post journal entry');
  }
}
