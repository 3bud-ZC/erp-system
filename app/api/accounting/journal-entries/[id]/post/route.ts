/**
 * POST /api/accounting/journal-entries/[id]/post
 * Post a draft journal entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { journalEntryService } from '@/lib/accounting/journal-entry.service';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { apiError } from '@/lib/api-response';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'manage_accounting')) return apiError('ليس لديك صلاحية', 403);

    const postedEntry = await journalEntryService.postEntry({
      tenantId: user.tenantId!,
      entryId: params.id,
      postedBy: user.id!,
    });

    return NextResponse.json(postedEntry);
  } catch (error: any) {
    console.error('Error posting journal entry:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post journal entry' },
      { status: 500 }
    );
  }
}
