/**
 * Income Statement API
 * GET /api/accounting/income-statement
 *
 * Returns Revenue, Expenses, and Net Profit for a date range.
 * Query params:
 *  - fromDate: YYYY-MM-DD (default: Jan 1 of current year)
 *  - toDate:   YYYY-MM-DD (default: now)
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
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), 0, 1);

    const fromDate = searchParams.get('fromDate')
      ? new Date(searchParams.get('fromDate')!)
      : defaultFrom;
    const toDate = searchParams.get('toDate')
      ? new Date(searchParams.get('toDate')! + 'T23:59:59.999Z')
      : now;

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
          entryDate: { gte: fromDate, lte: toDate },
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

    const revenueLines: { code: string; nameAr: string; amount: number }[] = [];
    const expenseLines: { code: string; nameAr: string; amount: number }[] = [];
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const acc of accounts) {
      const t = totalsMap.get(acc.code) ?? { debit: 0, credit: 0 };
      // Robust to schema variants: 'REVENUE' | 'Revenue' | 'revenue' | 'income' | 'INCOME'
      const typeNorm = (acc.type ?? '').toString().trim().toLowerCase();
      const isRevenue = typeNorm === 'revenue' || typeNorm === 'income';
      const isExpense = typeNorm === 'expense';

      if (isRevenue) {
        const amount = t.credit - t.debit;
        if (amount !== 0) {
          revenueLines.push({ code: acc.code, nameAr: acc.nameAr, amount });
          totalRevenue += amount;
        }
      } else if (isExpense) {
        const amount = t.debit - t.credit;
        if (amount !== 0) {
          expenseLines.push({ code: acc.code, nameAr: acc.nameAr, amount });
          totalExpenses += amount;
        }
      }
    }

    const netProfit = totalRevenue - totalExpenses;

    revenueLines.sort((a, b) => a.code.localeCompare(b.code));
    expenseLines.sort((a, b) => a.code.localeCompare(b.code));

    return apiSuccess(
      {
        period: { from: fromDate, to: toDate },
        revenue: { lines: revenueLines, total: totalRevenue },
        expenses: { lines: expenseLines, total: totalExpenses },
        netProfit,
      },
      'Income statement fetched'
    );
  } catch (error) {
    return handleApiError(error, 'Income statement');
  }
}
