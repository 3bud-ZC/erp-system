import { apiSuccess, handleApiError } from '@/lib/api-response';
import { withDashboard } from '@/lib/dashboard-helpers';
import { accountingAggregations } from '@/lib/aggregation-queries';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const data = await withDashboard(req, 'accounting', async ({ startDate, endDate }) => {
      const [ar, ap, revenueByAcc, expenseByAcc, journalCount] = await Promise.all([
        accountingAggregations.getAccountsReceivable(),
        accountingAggregations.getAccountsPayable(),
        accountingAggregations.getRevenueByAccount(startDate, endDate),
        accountingAggregations.getExpensesByAccount(startDate, endDate),
        prisma.journalEntry.count({ where: { entryDate: { gte: startDate, lte: endDate } } }),
      ]);
      const revenue = revenueByAcc.reduce((s: number, r: any) => s + Number(r._sum.credit || 0), 0);
      const expenses = expenseByAcc.reduce((s: number, r: any) => s + Number(r._sum.debit || 0), 0);
      return {
        kpis: {
          accountsReceivable: ar,
          accountsPayable: ap,
          netIncome: revenue - expenses,
          journalEntries: journalCount,
        },
        charts: { revenueByAccount: revenueByAcc, expenseByAccount: expenseByAcc },
        trends: { revenueVsExpenses: [{ label: 'revenue', value: revenue }, { label: 'expenses', value: expenses }] },
      };
    });
    return apiSuccess(data);
  } catch (e) { return handleApiError(e, 'Accounting dashboard'); }
}
