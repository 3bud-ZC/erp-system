import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/accounts/[accountId]/ledger
// Returns journal entry lines for one account, sorted by date ASC, with running balance
export async function GET(
  request: Request,
  { params }: { params: { accountId: string } }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!user.tenantId) return apiError('لم يتم تعيين مستأجر', 400);

    const { accountId } = params;
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate   = searchParams.get('toDate');
    const search   = searchParams.get('search') || '';
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit    = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') ?? '100')));

    // Verify account belongs to this tenant
    const account = await prisma.account.findFirst({
      where: { id: accountId, tenantId: user.tenantId },
    });
    if (!account) return apiError('الحساب غير موجود', 404);

    // Build journal entry date filter
    const entryDateFilter: Record<string, Date> = {};
    if (fromDate) entryDateFilter.gte = new Date(fromDate);
    if (toDate)   entryDateFilter.lte = new Date(toDate + 'T23:59:59.999Z');

    // Fetch ALL lines before the current page to compute running balance correctly
    // We need to include pre-period lines for accurate opening balance
    const allLines = await prisma.journalEntryLine.findMany({
      where: {
        tenantId:    user.tenantId,
        accountCode: account.code,
        journalEntry: {
          isPosted: true,
          tenantId: user.tenantId,
          ...(Object.keys(entryDateFilter).length > 0 && { entryDate: entryDateFilter }),
        },
        ...(search && {
          OR: [
            { description: { contains: search, mode: 'insensitive' } },
            { journalEntry: { description: { contains: search, mode: 'insensitive' } } },
            { journalEntry: { entryNumber: { contains: search, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        journalEntry: {
          select: {
            id:            true,
            entryNumber:   true,
            entryDate:     true,
            description:   true,
            referenceType: true,
            referenceId:   true,
          },
        },
      },
      orderBy: [
        { journalEntry: { entryDate: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    // Compute running balance across ALL lines (debit − credit cumulative)
    const isDebitNormal = ['Asset', 'Expense'].includes(account.type);
    let runningBalance = 0;
    const linesWithBalance = allLines.map(line => {
      const dr = Number(line.debit);
      const cr = Number(line.credit);
      runningBalance += isDebitNormal ? (dr - cr) : (cr - dr);
      return {
        id:            line.id,
        date:          line.journalEntry.entryDate,
        entryNumber:   line.journalEntry.entryNumber,
        description:   line.description || line.journalEntry.description || '',
        referenceType: line.journalEntry.referenceType,
        referenceId:   line.journalEntry.referenceId,
        debit:         dr,
        credit:        cr,
        balance:       runningBalance,
      };
    });

    const total       = linesWithBalance.length;
    const totalDebit  = linesWithBalance.reduce((s, l) => s + l.debit, 0);
    const totalCredit = linesWithBalance.reduce((s, l) => s + l.credit, 0);

    // Paginate AFTER running balance is computed
    const skip  = (page - 1) * limit;
    const paged = linesWithBalance.slice(skip, skip + limit);

    return apiSuccess({
      account: {
        id:      account.id,
        code:    account.code,
        nameAr:  account.nameAr,
        nameEn:  account.nameEn,
        type:    account.type,
        subType: account.subType,
        balance: Number(account.balance),
      },
      lines:       paged,
      total,
      page,
      limit,
      totalDebit,
      totalCredit,
      closingBalance: runningBalance,
    }, 'Ledger fetched');
  } catch (error) {
    return handleApiError(error, 'Fetch ledger');
  }
}
