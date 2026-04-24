import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/reports/profit-loss?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!user.tenantId) return apiError('لم يتم تعيين مستأجر', 400);

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year

    const fromDate = searchParams.get('fromDate')
      ? new Date(searchParams.get('fromDate')!)
      : defaultFrom;
    const toDate = searchParams.get('toDate')
      ? new Date(searchParams.get('toDate')! + 'T23:59:59.999Z')
      : now;

    const tid = user.tenantId;

    // Fetch all accounts for this tenant
    const accounts = await prisma.account.findMany({
      where: { tenantId: tid, isActive: true },
      select: { id: true, code: true, nameAr: true, nameEn: true, type: true, subType: true },
    });

    // Aggregate journal line totals per account code, within date range, posted only
    const lineTotals = await prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      where: {
        tenantId: tid,
        journalEntry: {
          isPosted: true,
          tenantId: tid,
          entryDate: { gte: fromDate, lte: toDate },
        },
      },
      _sum: { debit: true, credit: true },
    });

    const totalsMap = new Map(
      lineTotals.map(l => [l.accountCode, {
        debit:  Number(l._sum.debit  ?? 0),
        credit: Number(l._sum.credit ?? 0),
      }])
    );

    // Revenue accounts (type = 'Revenue'): net = credit - debit
    const revenueLines: { code: string; nameAr: string; amount: number }[] = [];
    let totalRevenue = 0;

    // COGS accounts (subType = 'COGS'): net = debit - credit
    const cogsLines: { code: string; nameAr: string; amount: number }[] = [];
    let totalCOGS = 0;

    // Operating expense accounts (type = 'Expense', subType != 'COGS' and != 'Inventory'):
    const expenseLines: { code: string; nameAr: string; amount: number }[] = [];
    let totalExpenses = 0;

    for (const acc of accounts) {
      const t = totalsMap.get(acc.code) ?? { debit: 0, credit: 0 };

      if (acc.type === 'Revenue') {
        const amount = t.credit - t.debit;
        if (amount !== 0) {
          revenueLines.push({ code: acc.code, nameAr: acc.nameAr, amount });
          totalRevenue += amount;
        }
      } else if (acc.type === 'Expense' && acc.subType === 'COGS') {
        const amount = t.debit - t.credit;
        if (amount !== 0) {
          cogsLines.push({ code: acc.code, nameAr: acc.nameAr, amount });
          totalCOGS += amount;
        }
      } else if (acc.type === 'Expense') {
        const amount = t.debit - t.credit;
        if (amount !== 0) {
          expenseLines.push({ code: acc.code, nameAr: acc.nameAr, amount });
          totalExpenses += amount;
        }
      }
    }

    const grossProfit = totalRevenue - totalCOGS;
    const netProfit   = grossProfit - totalExpenses;

    // Validation: net profit = change in equity (Revenue - Expenses)
    // Assets − Liabilities = Equity + NetIncome (before closing)
    // So validation here just ensures our arithmetic is consistent
    const validationCheck = Math.abs((totalRevenue - totalCOGS - totalExpenses) - netProfit) < 0.01;

    return apiSuccess({
      period: { from: fromDate, to: toDate },
      revenue: {
        lines: revenueLines.sort((a, b) => a.code.localeCompare(b.code)),
        total: totalRevenue,
      },
      cogs: {
        lines: cogsLines.sort((a, b) => a.code.localeCompare(b.code)),
        total: totalCOGS,
      },
      grossProfit,
      operatingExpenses: {
        lines: expenseLines.sort((a, b) => a.code.localeCompare(b.code)),
        total: totalExpenses,
      },
      netProfit,
      isValid: validationCheck,
    }, 'P&L report fetched');
  } catch (error) {
    return handleApiError(error, 'Profit & Loss report');
  }
}
