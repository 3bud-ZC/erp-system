/**
 * POST /api/accounting/periods/[id]/close
 * Close an accounting period
 */

import { NextRequest, NextResponse } from 'next/server';
import { accountingPeriodService } from '@/lib/accounting/period.service';

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

    const closedPeriod = await accountingPeriodService.closePeriod({
      tenantId,
      periodId: params.id,
      closedBy: userId,
    });

    return NextResponse.json(closedPeriod);
  } catch (error: any) {
    console.error('Error closing period:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to close period' },
      { status: 500 }
    );
  }
}
