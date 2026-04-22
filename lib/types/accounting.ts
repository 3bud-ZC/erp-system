/**
 * Accounting Types
 */

export interface Account {
  id: string;
  code: string;
  nameAr: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  balance: number;
  isActive: boolean;
  tenantId: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: Date;
  description: string;
  totalDebit: number;
  totalCredit: number;
  isPosted: boolean;
  postedDate?: Date;
  fiscalYearId?: string;
  accountingPeriodId?: string;
  tenantId: string;
  lines: JournalEntryLine[];
}

export interface JournalEntryLine {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
}

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
  asOfDate: Date;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  accounts: TrialBalanceAccount[];
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

export interface ProfitAndLossReport {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
}
