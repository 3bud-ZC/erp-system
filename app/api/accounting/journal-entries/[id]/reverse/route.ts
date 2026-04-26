/**
 * POST /api/accounting/journal-entries/[id]/reverse
 *
 * Creates a reversal entry for a POSTED journal entry. The original entry
 * is preserved (immutable, audit-friendly) and a new entry with debit/credit
 * swapped is written + posted, then linked to the original via reversalEntryId.
 */

import { NextRequest } from 'next/server';
import { journalEntryService } from '@/lib/accounting/journal-entry.service';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { apiError, apiSuccess, handleApiError } from '@/lib/api-response';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const body = await req.json().catch(() => ({}));
    const reason: string = (body?.reason ?? '').trim() || 'Manual reversal';

    const reversal = await journalEntryService.reverseEntry(
      params.id,
      user.tenantId!,
      reason,
      user.id!,
    );

    return apiSuccess(reversal, 'Journal entry reversed');
  } catch (error: any) {
    const msg: string = error?.message || '';
    if (
      msg.includes('Can only reverse posted') ||
      msg.includes('belongs to different tenant') ||
      msg.includes('already reversed') ||
      msg.includes('not found')
    ) {
      return apiError(msg, 400);
    }
    return handleApiError(error, 'Reverse journal entry');
  }
}
