import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get detailed cash flow report with investing and financing breakdown
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_accounting')) return apiError('ليس لديك صلاحية', 403);

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : new Date();
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip = (page - 1) * limit;

    // Get all journal entries for the period
    const allEntries = await prisma.journalEntry.findMany({
      where: {
        tenantId: user.tenantId,
        isPosted: true,
        entryDate: { gte: fromDate, lte: toDate },
      },
      include: { lines: true },
      orderBy: { entryDate: 'desc' },
      skip,
      take: limit,
    });

    // Cash flow categories
    const operatingActivities: any[] = [];
    const investingActivities: any[] = [];
    const financingActivities: any[] = [];

    let operatingCash = 0;
    let investingCash = 0;
    let financingCash = 0;

    allEntries.forEach((entry: any) => {
      entry.lines.forEach((line: any) => {
        const accountCode = line.accountCode;
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        const netCash = debit - credit;

        // Only process cash-related accounts (1001, 1010 for cash/bank)
        if (['1001', '1010'].includes(accountCode)) {
          const activityType = determineCashFlowActivity(entry.referenceType, accountCode);
          const activity = {
            date: entry.entryDate,
            description: entry.description,
            referenceType: entry.referenceType,
            referenceId: entry.referenceId,
            accountCode,
            amount: netCash,
            type: activityType,
          };

          if (activityType === 'operating') {
            operatingActivities.push(activity);
            operatingCash += netCash;
          } else if (activityType === 'investing') {
            investingActivities.push(activity);
            investingCash += netCash;
          } else if (activityType === 'financing') {
            financingActivities.push(activity);
            financingCash += netCash;
          }
        }
      });
    });

    // Calculate subtotals for investing activities
    const investingBreakdown = {
      fixedAssetPurchases: 0,
      fixedAssetSales: 0,
      otherInvestments: 0,
      total: investingCash,
    };

    investingActivities.forEach((activity) => {
      if (activity.referenceType === 'FixedAsset') {
        if (activity.amount < 0) {
          investingBreakdown.fixedAssetPurchases += Math.abs(activity.amount);
        } else {
          investingBreakdown.fixedAssetSales += activity.amount;
        }
      } else {
        investingBreakdown.otherInvestments += activity.amount;
      }
    });

    // Calculate subtotals for financing activities
    const financingBreakdown = {
      loansBorrowed: 0,
      loansRepaid: 0,
      capitalContributions: 0,
      dividendsPaid: 0,
      otherFinancing: 0,
      total: financingCash,
    };

    financingActivities.forEach((activity) => {
      if (activity.referenceType === 'Loan') {
        if (activity.amount > 0) {
          financingBreakdown.loansBorrowed += activity.amount;
        } else {
          financingBreakdown.loansRepaid += Math.abs(activity.amount);
        }
      } else if (activity.referenceType === 'Capital') {
        financingBreakdown.capitalContributions += activity.amount;
      } else if (activity.referenceType === 'Dividend') {
        financingBreakdown.dividendsPaid += Math.abs(activity.amount);
      } else {
        financingBreakdown.otherFinancing += activity.amount;
      }
    });

    // Calculate subtotals for operating activities
    const operatingBreakdown = {
      cashFromSales: 0,
      cashPaidToSuppliers: 0,
      cashPaidForExpenses: 0,
      otherOperating: 0,
      total: operatingCash,
    };

    operatingActivities.forEach((activity) => {
      if (activity.referenceType === 'SalesInvoice') {
        operatingBreakdown.cashFromSales += activity.amount;
      } else if (activity.referenceType === 'PurchaseInvoice') {
        operatingBreakdown.cashPaidToSuppliers += Math.abs(activity.amount);
      } else if (activity.referenceType === 'Expense') {
        operatingBreakdown.cashPaidForExpenses += Math.abs(activity.amount);
      } else {
        operatingBreakdown.otherOperating += activity.amount;
      }
    });

    const netCashIncrease = operatingCash + investingCash + financingCash;

    return apiSuccess(
      {
        period: { from: fromDate, to: toDate },
        operatingActivities: {
          items: operatingActivities,
          breakdown: operatingBreakdown,
          total: operatingCash,
        },
        investingActivities: {
          items: investingActivities,
          breakdown: investingBreakdown,
          total: investingCash,
        },
        financingActivities: {
          items: financingActivities,
          breakdown: financingBreakdown,
          total: financingCash,
        },
        netCashIncrease,
        summary: {
          totalCashGenerated: operatingCash + investingCash + financingCash,
          beginningCash: 0, // Could be calculated from prior periods
          endingCash: netCashIncrease, // Simplified for now
        },
        pagination: { total: allEntries.length, page, limit },
      },
      'Cash flow report fetched successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Fetch cash flow report');
  }
}

// Helper function to determine cash flow activity type
function determineCashFlowActivity(referenceType: string | null, accountCode: string): string {
  if (!referenceType) return 'operating';

  const financingTypes = ['Loan', 'Capital', 'Dividend', 'ShareCapital', 'RetainedEarnings'];
  const investingTypes = ['FixedAsset', 'AssetSale', 'Investment', 'Security'];

  if (financingTypes.includes(referenceType)) {
    return 'financing';
  }

  if (investingTypes.includes(referenceType)) {
    return 'investing';
  }

  return 'operating';
}
