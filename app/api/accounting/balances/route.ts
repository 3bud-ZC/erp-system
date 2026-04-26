/**
 * Balances API Routes
 * REST endpoints for account balance queries
 */

import { NextRequest } from 'next/server';
import { accountingService } from '@/lib/accounting/accounting.service';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';
import { apiError, apiSuccess, handleApiError } from '@/lib/api-response';

// ============================================================================
// GET /api/accounting/balances
// Get account balances
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const searchParams = req.nextUrl.searchParams;
    const accountCodes = searchParams.getAll('accountCode');
    const asOfDate = searchParams.get('asOfDate');
    const fiscalYearId = searchParams.get('fiscalYearId');
    const accountingPeriodId = searchParams.get('accountingPeriodId');

    if (accountCodes.length === 0) {
      return apiError('At least one account code is required', 400);
    }

    const balances = await accountingService.getAccountBalances(
      accountCodes,
      user.tenantId!,
      {
        asOfDate: asOfDate ? new Date(asOfDate) : undefined,
        fiscalYearId: fiscalYearId || undefined,
        accountingPeriodId: accountingPeriodId || undefined,
      }
    );

    return apiSuccess(balances);
  } catch (error: any) {
    return handleApiError(error, 'Get balances');
  }
}
