import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, handleApiError, apiError } from '@/lib/api-response';
import { getAuthenticatedUser, checkPermission } from '@/lib/auth';

// ==================== PROFIT & LOSS STATEMENT ====================

async function getProfitAndLossReport(fromDate?: Date, toDate?: Date) {
  const startDate = fromDate || new Date(new Date().getFullYear(), 0, 1);
  const endDate = toDate || new Date();

  const revenueEntries = await prisma.journalEntry.findMany({
    where: {
      isPosted: true,
      entryDate: {
        gte: startDate,
        lte: endDate,
      },
      referenceType: 'SalesInvoice',
    },
    include: { lines: true },
  });

  const expenseEntries = await prisma.journalEntry.findMany({
    where: {
      isPosted: true,
      entryDate: {
        gte: startDate,
        lte: endDate,
      },
      referenceType: { in: ['Expense', 'ProductionOrder'] },
    },
    include: { lines: true },
  });

  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalOperatingExpenses = 0;

  revenueEntries.forEach((entry) => {
    entry.lines.forEach((line) => {
      if (line.accountCode === '4010') {
        totalRevenue += Number(line.credit) - Number(line.debit);
      }
      if (line.accountCode === '5010') {
        totalCOGS += Number(line.debit) - Number(line.credit);
      }
    });
  });

  expenseEntries.forEach((entry) => {
    entry.lines.forEach((line) => {
      if (['5020', '5030', '5040', '5050', '5060'].includes(line.accountCode)) {
        totalOperatingExpenses += Number(line.debit) - Number(line.credit);
      }
    });
  });

  const grossProfit = totalRevenue - totalCOGS;
  const operatingIncome = grossProfit - totalOperatingExpenses;
  const netIncome = operatingIncome;

  return {
    period: { from: startDate, to: endDate },
    revenue: {
      salesRevenue: totalRevenue,
    },
    costOfGoodsSold: totalCOGS,
    grossProfit,
    operatingExpenses: {
      salaries: 0,
      rent: 0,
      utilities: 0,
      marketing: 0,
      miscellaneous: 0,
      total: totalOperatingExpenses,
    },
    operatingIncome,
    otherIncome: 0,
    netIncome,
  };
}

// ==================== BALANCE SHEET ====================

async function getBalanceSheet(asOfDate?: Date) {
  const date = asOfDate || new Date();

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: { journalLines: true },
  });

  const assets: any = {};
  const liabilities: any = {};
  const equity: any = {};

  for (const account of accounts) {
    const entries = await prisma.journalEntry.findMany({
      where: {
        isPosted: true,
        entryDate: { lte: date },
        lines: {
          some: { accountCode: account.code },
        },
      },
      include: { lines: true },
    });

    let balance = 0;
    entries.forEach((entry) => {
      const line = entry.lines.find((l) => l.accountCode === account.code);
      if (line) {
        balance += Number(line.debit) - Number(line.credit);
      }
    });

    const accountData = {
      code: account.code,
      name: account.nameAr || account.nameEn,
      balance,
    };

    if (account.type === 'Asset') {
      assets[account.code] = accountData;
    } else if (account.type === 'Liability') {
      liabilities[account.code] = accountData;
    } else if (account.type === 'Equity') {
      equity[account.code] = accountData;
    }
  }

  const totalAssets = Object.values(assets).reduce((sum: number, acc: any) => sum + acc.balance, 0);
  const totalLiabilities = Object.values(liabilities).reduce((sum: number, acc: any) => sum + acc.balance, 0);
  const totalEquity = Object.values(equity).reduce((sum: number, acc: any) => sum + acc.balance, 0);

  return {
    asOfDate: date,
    assets: {
      items: assets,
      total: totalAssets,
    },
    liabilities: {
      items: liabilities,
      total: totalLiabilities,
    },
    equity: {
      items: equity,
      total: totalEquity,
    },
    summary: {
      totalAssets,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    },
  };
}

// ==================== CASH FLOW REPORT ====================

async function getCashFlowReport(fromDate?: Date, toDate?: Date) {
  const startDate = fromDate || new Date(new Date().getFullYear(), 0, 1);
  const endDate = toDate || new Date();

  const operatingEntries = await prisma.journalEntry.findMany({
    where: {
      isPosted: true,
      entryDate: { gte: startDate, lte: endDate },
      referenceType: { in: ['SalesInvoice', 'Expense'] },
    },
    include: { lines: true },
  });

  const investingEntries = await prisma.journalEntry.findMany({
    where: {
      isPosted: true,
      entryDate: { gte: startDate, lte: endDate },
      referenceType: { in: ['FixedAsset', 'Equipment'] },
    },
    include: { lines: true },
  });

  const financingEntries = await prisma.journalEntry.findMany({
    where: {
      isPosted: true,
      entryDate: { gte: startDate, lte: endDate },
      referenceType: { in: ['Loan', 'Capital'] },
    },
    include: { lines: true },
  });

  let operatingCash = 0;
  let investingCash = 0;
  let financingCash = 0;

  operatingEntries.forEach((entry) => {
    entry.lines.forEach((line) => {
      if (['1001', '1010'].includes(line.accountCode)) {
        operatingCash += Number(line.debit) - Number(line.credit);
      }
    });
  });

  const netCashIncrease = operatingCash + investingCash + financingCash;

  return {
    period: { from: startDate, to: endDate },
    operatingActivities: {
      description: 'Cash from operations',
      amount: operatingCash,
    },
    investingActivities: {
      description: 'Cash from investing',
      amount: investingCash,
    },
    financingActivities: {
      description: 'Cash from financing',
      amount: financingCash,
    },
    netCashIncrease,
  };
}

// ==================== INVENTORY VALUATION ====================

async function getInventoryValuation() {
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
    include: { stockMovements: true },
  });

  let totalInventoryValue = 0;
  const items: any[] = [];

  for (const product of products) {
    const value = product.stock * product.cost;
    totalInventoryValue += value;

    items.push({
      productCode: product.code,
      productName: product.nameAr || product.nameEn,
      quantity: product.stock,
      unitCost: product.cost,
      totalValue: value,
    });
  }

  return {
    asOfDate: new Date(),
    items,
    totalValue: totalInventoryValue,
    itemCount: items.length,
  };
}

// ==================== API ROUTES ====================

// GET - Read reports
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('لم يتم المصادقة', 401);
    if (!checkPermission(user, 'view_financial_reports')) return apiError('ليس لديك صلاحية للقيام بهذا الإجراء', 403);

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'summary';
    const fromDate = searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')!) : undefined;
    const toDate = searchParams.get('toDate') ? new Date(searchParams.get('toDate')!) : undefined;

    let report: any = {};

    switch (reportType) {
      case 'profit-loss':
        report.profitAndLoss = await getProfitAndLossReport(fromDate, toDate);
        break;
      case 'balance-sheet':
        report.balanceSheet = await getBalanceSheet(toDate);
        break;
      case 'cash-flow':
        report.cashFlow = await getCashFlowReport(fromDate, toDate);
        break;
      case 'inventory':
        report.inventory = await getInventoryValuation();
        break;
      case 'summary':
      default:
        report = {
          profitAndLoss: await getProfitAndLossReport(fromDate, toDate),
          balanceSheet: await getBalanceSheet(toDate),
          cashFlow: await getCashFlowReport(fromDate, toDate),
          inventory: await getInventoryValuation(),
        };
        break;
    }

    return apiSuccess(report, 'Report fetched successfully');
  } catch (error) {
    return handleApiError(error, 'Generate report');
  }
}
