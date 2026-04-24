import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/reports/balance-sheet?asOfDate=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!user.tenantId) return apiError('لم يتم تعيين مستأجر', 400);

    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get('asOfDate')
      ? new Date(searchParams.get('asOfDate')! + 'T23:59:59.999Z')
      : new Date();

    const tid = user.tenantId;

    // Fetch all accounts for this tenant
    const accounts = await prisma.account.findMany({
      where: { tenantId: tid, isActive: true },
      select: { id: true, code: true, nameAr: true, nameEn: true, type: true, subType: true },
    });

    // Aggregate ALL journal line totals up to asOfDate (cumulative balances)
    const lineTotals = await prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      where: {
        tenantId: tid,
        journalEntry: {
          isPosted: true,
          tenantId: tid,
          entryDate: { lte: asOfDate },
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

    const assetLines:     { code: string; nameAr: string; amount: number; subType?: string | null }[] = [];
    const liabilityLines: { code: string; nameAr: string; amount: number; subType?: string | null }[] = [];
    const equityLines:    { code: string; nameAr: string; amount: number; subType?: string | null }[] = [];

    // Revenue and expense net (= retained earnings / net income not yet closed)
    let revenueNet  = 0;  // credit - debit for Revenue accounts
    let expenseNet  = 0;  // debit - credit for Expense accounts

    for (const acc of accounts) {
      const t = totalsMap.get(acc.code) ?? { debit: 0, credit: 0 };

      switch (acc.type) {
        case 'Asset': {
          // Asset: debit-normal → balance = debit - credit
          const amount = t.debit - t.credit;
          assetLines.push({ code: acc.code, nameAr: acc.nameAr, amount, subType: acc.subType });
          break;
        }
        case 'Liability': {
          // Liability: credit-normal → balance = credit - debit
          const amount = t.credit - t.debit;
          liabilityLines.push({ code: acc.code, nameAr: acc.nameAr, amount, subType: acc.subType });
          break;
        }
        case 'Equity': {
          // Equity: credit-normal → balance = credit - debit
          const amount = t.credit - t.debit;
          equityLines.push({ code: acc.code, nameAr: acc.nameAr, amount, subType: acc.subType });
          break;
        }
        case 'Revenue':
          revenueNet += t.credit - t.debit;
          break;
        case 'Expense':
          expenseNet += t.debit - t.credit;
          break;
      }
    }

    // Net income = Revenue − Expenses (flows into equity as retained earnings)
    const netIncome = revenueNet - expenseNet;

    // Sort all lines by account code
    const sort = (arr: typeof assetLines) => arr.sort((a, b) => a.code.localeCompare(b.code));
    sort(assetLines); sort(liabilityLines); sort(equityLines);

    const totalAssets      = assetLines.reduce((s, l) => s + l.amount, 0);
    const totalLiabilities = liabilityLines.reduce((s, l) => s + l.amount, 0);
    const totalEquity      = equityLines.reduce((s, l) => s + l.amount, 0);
    const totalEquityWithIncome = totalEquity + netIncome;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquityWithIncome;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;
    const difference = totalAssets - totalLiabilitiesAndEquity;

    return apiSuccess({
      asOfDate,
      assets: {
        lines: assetLines,
        total: totalAssets,
      },
      liabilities: {
        lines: liabilityLines,
        total: totalLiabilities,
      },
      equity: {
        lines: equityLines,
        netIncome,           // current period net income not yet closed
        total: totalEquity,
        totalWithIncome: totalEquityWithIncome,
      },
      summary: {
        totalAssets,
        totalLiabilities,
        totalEquity: totalEquityWithIncome,
        totalLiabilitiesAndEquity,
        isBalanced,
        difference,
      },
    }, 'Balance sheet fetched');
  } catch (error) {
    return handleApiError(error, 'Balance sheet report');
  }
}
