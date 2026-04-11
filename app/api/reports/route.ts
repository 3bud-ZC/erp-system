import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// ==================== PROFIT & LOSS STATEMENT ====================

async function getProfitAndLossReport(fromDate?: Date, toDate?: Date) {
  const startDate = fromDate || new Date(new Date().getFullYear(), 0, 1);
  const endDate = toDate || new Date();

  // Fetch revenue transactions
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

  // Fetch expense transactions
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

  // Calculate totals
  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalOperatingExpenses = 0;

  // Process revenue (account 4010 - Sales Revenue)
  revenueEntries.forEach((entry) => {
    entry.lines.forEach((line) => {
      if (line.accountCode === '4010') {
        totalRevenue += Number(line.credit) - Number(line.debit);
      }
      // COGS (account 5010)
      if (line.accountCode === '5010') {
        totalCOGS += Number(line.debit) - Number(line.credit);
      }
    });
  });

  // Process expenses
  expenseEntries.forEach((entry) => {
    entry.lines.forEach((line) => {
      // Operating expenses (5020-5060)
      if (['5020', '5030', '5040', '5050', '5060'].includes(line.accountCode)) {
        totalOperatingExpenses += Number(line.debit) - Number(line.credit);
      }
    });
  });

  const grossProfit = totalRevenue - totalCOGS;
  const operatingIncome = grossProfit - totalOperatingExpenses;
  const netIncome = operatingIncome; // Simplified (no taxes/interest)

  return {
    period: { from: startDate, to: endDate },
    revenue: {
      salesRevenue: totalRevenue,
    },
    costOfGoodsSold: totalCOGS,
    grossProfit,
    operatingExpenses: {
      salaries: 0, // Would need to aggregate by account
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

  // Fetch all accounts and their balances
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: { journalLines: true },
  });

  // Calculate balance for each account up to asOfDate
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

  // Operating activities
  const operatingEntries = await prisma.journalEntry.findMany({
    where: {
      isPosted: true,
      entryDate: { gte: startDate, lte: endDate },
      referenceType: { in: ['SalesInvoice', 'Expense'] },
    },
    include: { lines: true },
  });

  // Investing activities (fixed assets)
  const investingEntries = await prisma.journalEntry.findMany({
    where: {
      isPosted: true,
      entryDate: { gte: startDate, lte: endDate },
      referenceType: { in: ['FixedAsset', 'Equipment'] },
    },
    include: { lines: true },
  });

  // Financing activities (loans, capital)
  const financingEntries = await prisma.journalEntry.findMany({
    where: {
      isPosted: true,
      entryDate: { gte: startDate, lte: endDate },
      referenceType: { in: ['Loan', 'Capital'] },
    },
    include: { lines: true },
  });

  // Calculate cash movements
  let operatingCash = 0;
  let investingCash = 0;
  let financingCash = 0;

  // Operating: Cash receipts from sales (account 1001/1010)
  operatingEntries.forEach((entry) => {
    entry.lines.forEach((line) => {
      if (['1001', '1010'].includes(line.accountCode)) {
        operatingCash += Number(line.debit) - Number(line.credit);
      }
    });
  });

  // Simplified calculation
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

export async function GET(request: Request) {
  try {
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
        // Return all reports
        report = {
          profitAndLoss: await getProfitAndLossReport(fromDate, toDate),
          balanceSheet: await getBalanceSheet(toDate),
          cashFlow: await getCashFlowReport(fromDate, toDate),
          inventory: await getInventoryValuation(),
        };
        break;
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
