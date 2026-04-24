/**
 * POST /api/accounting/periods/[id]/close
 * Close an accounting period
 */

import { NextRequest, NextResponse } from 'next/server';
import { accountingPeriodService } from '@/lib/accounting/period.service';
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

    const closedPeriod = await accountingPeriodService.closePeriod({
      tenantId: user.tenantId!,
      periodId: params.id,
      closedBy: user.id!,
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
