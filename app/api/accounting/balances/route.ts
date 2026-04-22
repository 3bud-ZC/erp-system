/**
 * Balances API Routes
 * REST endpoints for account balance queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { accountingService } from '@/lib/accounting/accounting.service';

// ============================================================================
// GET /api/accounting/balances
// Get account balances
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const accountCodes = searchParams.getAll('accountCode');
    const asOfDate = searchParams.get('asOfDate');
    const fiscalYearId = searchParams.get('fiscalYearId');
    const accountingPeriodId = searchParams.get('accountingPeriodId');
    const useCache = searchParams.get('useCache') !== 'false';

    if (accountCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one account code is required' },
        { status: 400 }
      );
    }

    const balances = await accountingService.getAccountBalances(
      accountCodes,
      tenantId,
      {
        asOfDate: asOfDate ? new Date(asOfDate) : undefined,
        fiscalYearId: fiscalYearId || undefined,
        accountingPeriodId: accountingPeriodId || undefined,
      }
    );

    return NextResponse.json(balances);
  } catch (error: any) {
    console.error('Error getting balances:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get balances' },
      { status: 500 }
    );
  }
}
