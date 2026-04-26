/**
 * Balance Sheet API
 * GET /api/accounting/balance-sheet
 *
 * Returns Assets, Liabilities, Equity (with current-period net income) as of a date.
 * Query params:
 *  - asOfDate: YYYY-MM-DD (default: now)
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
    const asOfDate = searchParams.get('asOfDate')
      ? new Date(searchParams.get('asOfDate')! + 'T23:59:59.999Z')
      : new Date();

    const tenantId = user.tenantId;

    const accounts = await prisma.account.findMany({
      where: { tenantId, isActive: true },
      select: { code: true, nameAr: true, type: true, subType: true },
    });

    const lineTotals = await prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      where: {
        tenantId,
        journalEntry: {
          tenantId,
          isPosted: true,
          entryDate: { lte: asOfDate },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const totalsMap = new Map(
      lineTotals.map((l) => [
        l.accountCode,
        {
          debit: Number(l._sum.debit ?? 0),
          credit: Number(l._sum.credit ?? 0),
        },
      ])
    );

    type Line = { code: string; nameAr: string; amount: number };
    const assetLines: Line[] = [];
    const liabilityLines: Line[] = [];
    const equityLines: Line[] = [];
    let revenueNet = 0;
    let expenseNet = 0;

    for (const acc of accounts) {
      const t = totalsMap.get(acc.code) ?? { debit: 0, credit: 0 };
      // Robust to schema variants: 'ASSET'/'Asset'/'asset', 'income' as revenue alias, etc.
      const typeNorm = (acc.type ?? '').toString().trim().toLowerCase();

      if (typeNorm === 'asset') {
        const amount = t.debit - t.credit;
        assetLines.push({ code: acc.code, nameAr: acc.nameAr, amount });
      } else if (typeNorm === 'liability') {
        const amount = t.credit - t.debit;
        liabilityLines.push({ code: acc.code, nameAr: acc.nameAr, amount });
      } else if (typeNorm === 'equity') {
        const amount = t.credit - t.debit;
        equityLines.push({ code: acc.code, nameAr: acc.nameAr, amount });
      } else if (typeNorm === 'revenue' || typeNorm === 'income') {
        revenueNet += t.credit - t.debit;
      } else if (typeNorm === 'expense') {
        expenseNet += t.debit - t.credit;
      }
    }

    const sort = (arr: Line[]) => arr.sort((a, b) => a.code.localeCompare(b.code));
    sort(assetLines);
    sort(liabilityLines);
    sort(equityLines);

    const netIncome = revenueNet - expenseNet;
    const totalAssets = assetLines.reduce((s, l) => s + l.amount, 0);
    const totalLiabilities = liabilityLines.reduce((s, l) => s + l.amount, 0);
    const totalEquityRaw = equityLines.reduce((s, l) => s + l.amount, 0);
    const totalEquity = totalEquityRaw + netIncome;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    return apiSuccess(
      {
        asOfDate,
        assets: { lines: assetLines, total: totalAssets },
        liabilities: { lines: liabilityLines, total: totalLiabilities },
        equity: {
          lines: equityLines,
          netIncome,
          total: totalEquity,
        },
        summary: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          totalLiabilitiesAndEquity,
          isBalanced,
        },
      },
      'Balance sheet fetched'
    );
  } catch (error) {
    return handleApiError(error, 'Balance sheet');
  }
}
