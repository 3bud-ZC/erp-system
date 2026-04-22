/**
 * POST /api/accounting/journal-entries/[id]/post
 * Post a draft journal entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { journalEntryService } from '@/lib/accounting/journal-entry.service';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = req.headers.get('x-tenant-id');
    const userId = req.headers.get('x-user-id');

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Tenant ID and User ID are required' },
        { status: 400 }
      );
    }

    const postedEntry = await journalEntryService.postEntry({
      tenantId,
      entryId: params.id,
      postedBy: userId,
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
