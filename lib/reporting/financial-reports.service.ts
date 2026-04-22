/**
 * Financial Reporting Service - Production-Grade
 * Read-only reporting layer with optimized queries
 */

import { prisma } from '../db';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TrialBalanceAccount {
  accountCode: string;
  accountName: string;
  accountType: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

export interface TrialBalanceReport {
  tenantId: string;
  fiscalYearId?: string;
  accountingPeriodId?: string;
  asOfDate: Date;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  accounts: TrialBalanceAccount[];
}

export interface GeneralLedgerEntry {
  entryDate: Date;
  entryNumber: string;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  referenceType?: string;
  referenceId?: string;
}

export interface GeneralLedgerReport {
  tenantId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  startDate: Date;
  endDate: Date;
  openingBalance: number;
  entries: GeneralLedgerEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

export interface ProfitAndLossReport {
  tenantId: string;
  fiscalYearId?: string;
  accountingPeriodId?: string;
  startDate: Date;
  endDate: Date;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
}

export interface BalanceSheetReport {
  tenantId: string;
  asOfDate: Date;
  assets: number;
  liabilities: number;
  equity: number;
  currentAssets: number;
  currentLiabilities: number;
  workingCapital: number;
}

// ============================================================================
// TRIAL BALANCE
// ============================================================================

/**
 * Generate Trial Balance Report
 * Verifies that total debits equal total credits
 */
export async function generateTrialBalance(
  tenantId: string,
  options: {
    fiscalYearId?: string;
    accountingPeriodId?: string;
    asOfDate?: Date;
  } = {}
): Promise<TrialBalanceReport> {
  const where: any = {
    tenantId,
    isPosted: true,
  };

  if (options.fiscalYearId) {
    where.fiscalYearId = options.fiscalYearId;
  }

  if (options.accountingPeriodId) {
    where.accountingPeriodId = options.accountingPeriodId;
  }

  if (options.asOfDate) {
    where.entryDate = { lte: options.asOfDate };
  }

  // Get all journal entries for the period
  const journalEntries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: {
          account: {
            select: {
              code: true,
              nameAr: true,
              type: true,
            },
          },
        },
      },
    },
  });

  // Aggregate by account
  const accountBalances = new Map<string, TrialBalanceAccount>();

  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      const accountCode = line.accountCode;
      const existing = accountBalances.get(accountCode) || {
        accountCode,
        accountName: line.account.nameAr,
        accountType: line.account.type,
        debitTotal: 0,
        creditTotal: 0,
        balance: 0,
      };

      existing.debitTotal += Number(line.debit);
      existing.creditTotal += Number(line.credit);

      // Calculate balance based on account type
      // Debit accounts (Assets, Expenses): debit increases balance
      // Credit accounts (Liabilities, Equity, Revenue): credit increases balance
      if (['ASSET', 'EXPENSE'].includes(existing.accountType)) {
        existing.balance = existing.debitTotal - existing.creditTotal;
      } else {
        existing.balance = existing.creditTotal - existing.debitTotal;
      }

      accountBalances.set(accountCode, existing);
    }
  }

  const accounts = Array.from(accountBalances.values());
  const totalDebit = accounts.reduce((sum, acc) => sum + acc.debitTotal, 0);
  const totalCredit = accounts.reduce((sum, acc) => sum + acc.creditTotal, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return {
    tenantId,
    fiscalYearId: options.fiscalYearId,
    accountingPeriodId: options.accountingPeriodId,
    asOfDate: options.asOfDate || new Date(),
    totalDebit,
    totalCredit,
    isBalanced,
    accounts,
  };
}

// ============================================================================
// GENERAL LEDGER
// ============================================================================

/**
 * Generate General Ledger Report for a specific account
 */
export async function generateGeneralLedger(
  tenantId: string,
  accountCode: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<GeneralLedgerReport> {
  // Validate account exists and belongs to tenant
  const account = await prisma.account.findFirst({
    where: {
      code: accountCode,
      tenantId,
    },
    select: {
      code: true,
      nameAr: true,
      type: true,
      balance: true,
    },
  });

  if (!account) {
    throw new Error(`Account ${accountCode} not found for tenant ${tenantId}`);
  }

  const where: any = {
    tenantId,
    isPosted: true,
    lines: {
      accountCode,
    },
  };

  if (options.startDate || options.endDate) {
    where.entryDate = {};
    if (options.startDate) where.entryDate.gte = options.startDate;
    if (options.endDate) where.entryDate.lte = options.endDate;
  }

  // Get journal entries for the account
  const journalEntries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        where: {
          accountCode,
        },
        include: {
          account: {
            select: {
              code: true,
              nameAr: true,
            },
          },
        },
      },
    },
    orderBy: { entryDate: 'asc' },
  });

  // Build ledger entries
  const entries: GeneralLedgerEntry[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      entries.push({
        entryDate: entry.entryDate,
        entryNumber: entry.entryNumber,
        description: entry.description || '',
        accountCode: line.accountCode,
        accountName: line.account.nameAr,
        debit: Number(line.debit),
        credit: Number(line.credit),
        referenceType: entry.referenceType || undefined,
        referenceId: entry.referenceId || undefined,
      });

      totalDebit += Number(line.debit);
      totalCredit += Number(line.credit);
    }
  }

  // Calculate opening balance (balance before startDate)
  let openingBalance = 0;
  if (options.startDate) {
    const openingEntries = await prisma.journalEntry.findMany({
      where: {
        tenantId,
        isPosted: true,
        lines: {
          some: {
            accountCode,
          },
        },
        entryDate: {
          lt: options.startDate,
        },
      },
      include: {
        lines: {
          where: {
            accountCode,
          },
        },
      },
    });

    for (const entry of openingEntries) {
      for (const line of entry.lines) {
        if (['ASSET', 'EXPENSE'].includes(account.type)) {
          openingBalance += Number(line.debit) - Number(line.credit);
        } else {
          openingBalance += Number(line.credit) - Number(line.debit);
        }
      }
    }
  } else {
    openingBalance = Number(account.balance);
  }

  // Calculate closing balance
  let closingBalance = openingBalance;
  if (['ASSET', 'EXPENSE'].includes(account.type)) {
    closingBalance += totalDebit - totalCredit;
  } else {
    closingBalance += totalCredit - totalDebit;
  }

  return {
    tenantId,
    accountCode,
    accountName: account.nameAr,
    accountType: account.type,
    startDate: options.startDate || new Date(0),
    endDate: options.endDate || new Date(),
    openingBalance,
    entries,
    closingBalance,
    totalDebit,
    totalCredit,
  };
}

// ============================================================================
// PROFIT AND LOSS STATEMENT
// ============================================================================

/**
 * Generate Profit and Loss Statement
 */
export async function generateProfitAndLoss(
  tenantId: string,
  options: {
    fiscalYearId?: string;
    accountingPeriodId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<ProfitAndLossReport> {
  const where: any = {
    tenantId,
    isPosted: true,
  };

  if (options.fiscalYearId) {
    where.fiscalYearId = options.fiscalYearId;
  }

  if (options.accountingPeriodId) {
    where.accountingPeriodId = options.accountingPeriodId;
  }

  if (options.startDate || options.endDate) {
    where.entryDate = {};
    if (options.startDate) where.entryDate.gte = options.startDate;
    if (options.endDate) where.entryDate.lte = options.endDate;
  }

  // Get all journal entries
  const journalEntries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: {
          account: {
            select: {
              code: true,
              type: true,
            },
          },
        },
      },
    },
  });

  // Calculate revenue, expenses, and COGS
  let revenue = 0;
  let cogs = 0;
  let operatingExpenses = 0;

  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      const amount = Number(line.credit) || Number(line.debit);
      const accountType = line.account.type;

      if (accountType === 'REVENUE') {
        revenue += Number(line.credit) - Number(line.debit);
      } else if (accountType === 'EXPENSE') {
        // COGS accounts typically start with 5xxx
        if (line.accountCode.startsWith('5')) {
          cogs += Number(line.debit) - Number(line.credit);
        } else {
          operatingExpenses += Number(line.debit) - Number(line.credit);
        }
      }
    }
  }

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - operatingExpenses;

  return {
    tenantId,
    fiscalYearId: options.fiscalYearId,
    accountingPeriodId: options.accountingPeriodId,
    startDate: options.startDate || new Date(0),
    endDate: options.endDate || new Date(),
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    netProfit,
  };
}

// ============================================================================
// BALANCE SHEET
// ============================================================================

/**
 * Generate Balance Sheet Report
 */
export async function generateBalanceSheet(
  tenantId: string,
  asOfDate: Date = new Date()
): Promise<BalanceSheetReport> {
  const where: any = {
    tenantId,
    isPosted: true,
    entryDate: { lte: asOfDate },
  };

  // Get all journal entries up to asOfDate
  const journalEntries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: {
          account: {
            select: {
              code: true,
              type: true,
            },
          },
        },
      },
    },
  });

  // Calculate account balances
  const accountBalances = new Map<string, { type: string; balance: number }>();

  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      const accountCode = line.accountCode;
      const accountType = line.account.type;
      const existing = accountBalances.get(accountCode) || {
        type: accountType,
        balance: 0,
      };

      if (['ASSET', 'EXPENSE'].includes(accountType)) {
        existing.balance += Number(line.debit) - Number(line.credit);
      } else {
        existing.balance += Number(line.credit) - Number(line.debit);
      }

      accountBalances.set(accountCode, existing);
    }
  }

  // Aggregate by type
  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let currentAssets = 0;
  let currentLiabilities = 0;

  for (const [accountCode, data] of Array.from(accountBalances)) {
    // Current assets typically start with 1xxx
    if (data.type === 'ASSET') {
      assets += data.balance;
      if (accountCode.startsWith('1')) {
        currentAssets += data.balance;
      }
    } else if (data.type === 'LIABILITY') {
      liabilities += data.balance;
      // Current liabilities typically start with 2xxx
      if (accountCode.startsWith('2')) {
        currentLiabilities += data.balance;
      }
    } else if (data.type === 'EQUITY') {
      equity += data.balance;
    }
  }

  const workingCapital = currentAssets - currentLiabilities;

  return {
    tenantId,
    asOfDate,
    assets,
    liabilities,
    equity,
    currentAssets,
    currentLiabilities,
    workingCapital,
  };
}

// ============================================================================
// CASH FLOW (Basic Version)
// ============================================================================

export interface CashFlowReport {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  netCashFlow: number;
}

/**
 * Generate Basic Cash Flow Statement
 */
export async function generateCashFlow(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<CashFlowReport> {
  const where: any = {
    tenantId,
    isPosted: true,
    entryDate: {
      gte: startDate,
      lte: endDate,
    },
  };

  // Get journal entries
  const journalEntries = await prisma.journalEntry.findMany({
    where,
    include: {
      lines: {
        include: {
          account: {
            select: {
              code: true,
              type: true,
            },
          },
        },
      },
    },
  });

  // Calculate cash flows (simplified)
  let operatingCashFlow = 0;
  let investingCashFlow = 0;
  let financingCashFlow = 0;

  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      const amount = Number(line.debit) - Number(line.credit);
      const accountCode = line.accountCode;

      // Cash account (1xxx)
      if (accountCode.startsWith('1')) {
        // Operating cash (from sales, payments)
        if (line.account.type === 'ASSET' && accountCode.startsWith('10')) {
          operatingCashFlow += amount;
        }
      }
    }
  }

  const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

  return {
    tenantId,
    startDate,
    endDate,
    operatingCashFlow,
    investingCashFlow,
    financingCashFlow,
    netCashFlow,
  };
}
