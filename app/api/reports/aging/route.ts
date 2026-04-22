import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Generate Aging Reports (AR/AP)
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_financial_reports')) return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'ar'; // 'ar' for Accounts Receivable, 'ap' for Accounts Payable
    const asOfDate = searchParams.get('asOfDate') ? new Date(searchParams.get('asOfDate')!) : new Date();

    if (type !== 'ar' && type !== 'ap') {
      return apiError('Type must be either "ar" or "ap"', 400);
    }

    // Get all posted journal entries up to the as-of date
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        isPosted: true,
        entryDate: { lte: asOfDate },
      },
      include: { lines: true },
    });

    // Calculate balances by customer or supplier
    const balances = new Map<string, any>();

    journalEntries.forEach((entry: any) => {
      entry.lines.forEach((line: any) => {
        const accountCode = line.accountCode;
        const debit = Number(line.debit);
        const credit = Number(line.credit);

        // AR: Account 1021 (Accounts Receivable)
        // AP: Account 2011 (Accounts Payable)
        const isAR = accountCode === '1021';
        const isAP = accountCode === '2011';

        if ((type === 'ar' && isAR) || (type === 'ap' && isAP)) {
          const netAmount = isAR ? debit - credit : credit - debit;
          const entityId = entry.referenceId;
          
          if (!balances.has(entityId)) {
            balances.set(entityId, {
              entityId,
              balance: 0,
              transactions: [],
            });
          }

          const balanceData = balances.get(entityId);
          balanceData.balance += netAmount;
          balanceData.transactions.push({
            date: entry.entryDate,
            description: entry.description,
            amount: netAmount,
            referenceType: entry.referenceType,
          });
        }
      });
    });

    // Calculate aging buckets
    const agingBuckets = {
      current: 0,
      '1-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    };

    const details: any[] = [];

    const now = asOfDate;
    const oneDay = 24 * 60 * 60 * 1000;

    const balanceEntries = Array.from(balances.entries());
    for (let i = 0; i < balanceEntries.length; i++) {
      const [entityId, data] = balanceEntries[i];
      if (data.balance <= 0) continue; // Skip zero or negative balances

      // Get entity details
      let entity;
      if (type === 'ar') {
        entity = await prisma.customer.findUnique({
          where: { id: entityId },
          select: { id: true, code: true, nameAr: true, nameEn: true },
        });
      } else {
        entity = await prisma.supplier.findUnique({
          where: { id: entityId },
          select: { id: true, code: true, nameAr: true, nameEn: true },
        });
      }

      if (!entity) continue;

      // Calculate aging based on oldest transaction
      const oldestTransaction = data.transactions
        .filter((t: any) => t.amount > 0)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

      let daysOverdue = 0;
      let bucket = 'current';
      
      if (oldestTransaction) {
        const transactionDate = new Date(oldestTransaction.date);
        daysOverdue = Math.floor((now.getTime() - transactionDate.getTime()) / oneDay);

        if (daysOverdue > 90) {
          bucket = '90+';
        } else if (daysOverdue > 60) {
          bucket = '61-90';
        } else if (daysOverdue > 30) {
          bucket = '31-60';
        } else if (daysOverdue > 0) {
          bucket = '1-30';
        }
      }

      agingBuckets[bucket as keyof typeof agingBuckets] += data.balance;

      details.push({
        entity,
        balance: data.balance,
        daysOverdue,
        bucket,
        transactionCount: data.transactions.length,
      });
    }

    const totalOutstanding = Object.values(agingBuckets).reduce((sum, val) => sum + val, 0);

    return apiSuccess(
      {
        type: type === 'ar' ? 'Accounts Receivable' : 'Accounts Payable',
        asOfDate,
        summary: {
          totalOutstanding,
          agingBuckets,
        },
        details: details.sort((a, b) => b.balance - a.balance),
      },
      'Aging report generated successfully'
    );
  } catch (error) {
    return handleApiError(error, 'Generate aging report');
  }
}
