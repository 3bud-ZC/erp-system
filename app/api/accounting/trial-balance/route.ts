/**
 * Trial Balance API
 * GET /api/accounting/trial-balance
 *
 * Returns aggregated debit/credit totals per account from posted journal entries.
 * Optional query params:
 *  - asOfDate: YYYY-MM-DD (default: now)
 *  - fiscalYearId
 *  - accountingPeriodId
 */

import { prisma } from '@/lib/db';
import { apiSuccess, apiError, handleApiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!user.tenantId) return apiError('لم يتم تعيين مستأجر للمستخدم', 400);
    if (!checkPermission(user, 'view_accounting')) {
      return apiError('ليس لديك صلاحية لعرض المحاسبة', 403);
    }

    const { searchParams } = new URL(request.url);
    const asOfRaw = searchParams.get('asOfDate');
    const asOfDate = asOfRaw
      ? new Date(asOfRaw + 'T23:59:59.999Z')
      : new Date();
    const fiscalYearId = searchParams.get('fiscalYearId') || undefined;
    const accountingPeriodId = searchParams.get('accountingPeriodId') || undefined;

    const tenantId = user.tenantId;

    // Fetch active accounts for naming/type lookup
    const accounts = await prisma.account.findMany({
      where: { tenantId, isActive: true },
      select: { code: true, nameAr: true, nameEn: true, type: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.code, a]));

    // Build journal-entry filter
    const journalFilter: any = {
      tenantId,
      isPosted: true,
      entryDate: { lte: asOfDate },
    };
    if (fiscalYearId) journalFilter.fiscalYearId = fiscalYearId;
    if (accountingPeriodId) journalFilter.accountingPeriodId = accountingPeriodId;

    const lineTotals = await prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      where: {
        tenantId,
        journalEntry: journalFilter,
      },
      _sum: { debit: true, credit: true },
    });

    // Map to client-friendly shape
    const data = lineTotals
      .map((row) => {
        const acc = accountMap.get(row.accountCode);
        const debit = Number(row._sum.debit ?? 0);
        const credit = Number(row._sum.credit ?? 0);
        return {
          account: acc?.nameAr ?? row.accountCode,
          accountCode: row.accountCode,
          accountNameAr: acc?.nameAr ?? row.accountCode,
          accountNameEn: acc?.nameEn ?? null,
          accountType: acc?.type ?? null,
          debit,
          credit,
        };
      })
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalDebit = data.reduce((s, r) => s + r.debit, 0);
    const totalCredit = data.reduce((s, r) => s + r.credit, 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    return apiSuccess(
      data,
      `Trial balance fetched (${data.length} accounts, balanced=${isBalanced})`
    );
  } catch (error) {
    return handleApiError(error, 'Trial balance');
  }
}
