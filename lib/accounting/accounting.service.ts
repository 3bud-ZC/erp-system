/**
 * Main Accounting Service
 * High-level accounting operations integrating all accounting services
 */

import { journalEntryService, CreateJournalEntryInput } from './journal-entry.service';
// import { chartOfAccountsService } from './chart-of-accounts.service';
import { accountingPeriodService } from './period.service';
import { prisma } from '../db';

// ============================================================================
// TYPES
// ============================================================================

export interface SalesAccountingInput {
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  invoiceDate: Date;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  costOfGoodsSold: number;
  fiscalYearId?: string;
  accountingPeriodId?: string;
  sourceEventId?: string;
  correlationId?: string;
  createdBy?: string;
}

export interface PurchaseAccountingInput {
  tenantId: string;
  purchaseId: string;
  purchaseNumber: string;
  supplierId: string;
  purchaseDate: Date;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  fiscalYearId?: string;
  accountingPeriodId?: string;
  sourceEventId?: string;
  correlationId?: string;
  createdBy?: string;
}

export interface PaymentAccountingInput {
  tenantId: string;
  paymentId: string;
  paymentDate: Date;
  amount: number;
  customerId?: string;
  supplierId?: string;
  invoiceId?: string;
  invoiceType?: 'sales' | 'purchase';
  fiscalYearId?: string;
  accountingPeriodId?: string;
  sourceEventId?: string;
  correlationId?: string;
  createdBy?: string;
}

export interface AccountBalance {
  accountCode: string;
  accountName: string;
  accountType: string;
  balance: number;
  debitTotal: number;
  creditTotal: number;
  asOfDate: Date;
}

// ============================================================================
// ACCOUNTING SERVICE
// ============================================================================

export class AccountingService {
  /**
   * Create accounting entry for sales invoice
   * Debit: Accounts Receivable
   * Credit: Sales Revenue
   * Debit: Cost of Goods Sold
   * Credit: Inventory
   */
  async recordSales(input: SalesAccountingInput) {
    // Get current open period if not provided
    let periodId = input.accountingPeriodId;
    let fiscalYearId = input.fiscalYearId;

    if (!periodId) {
      const openPeriod = await accountingPeriodService.getCurrentOpenPeriod(input.tenantId, input.invoiceDate);
      if (openPeriod) {
        periodId = openPeriod.id;
        fiscalYearId = openPeriod.fiscalYearId;
      }
    }

    // Create journal entry
    const journalEntryInput: CreateJournalEntryInput = {
      tenantId: input.tenantId,
      entryDate: input.invoiceDate,
      description: `Sales Invoice ${input.invoiceNumber} - Customer ${input.customerId}`,
      referenceType: 'SalesInvoice',
      referenceId: input.invoiceId,
      fiscalYearId,
      accountingPeriodId: periodId,
      sourceEventId: input.sourceEventId,
      correlationId: input.correlationId,
      createdBy: input.createdBy,
      lines: [
        {
          accountCode: '1020', // Accounts Receivable
          debit: input.total,
          credit: 0,
          description: `Customer: ${input.customerId}`,
        },
        {
          accountCode: '4010', // Sales Revenue
          debit: 0,
          credit: input.total,
          description: `Sales Invoice ${input.invoiceNumber}`,
        },
      ],
    };

    // Add COGS and inventory lines if cost is provided
    if (input.costOfGoodsSold > 0 && journalEntryInput.lines) {
      journalEntryInput.lines.push(
        {
          accountCode: '5010', // Cost of Goods Sold
          debit: input.costOfGoodsSold,
          credit: 0,
          description: `COGS for Invoice ${input.invoiceNumber}`,
        },
        {
          accountCode: '1030', // Inventory
          debit: 0,
          credit: input.costOfGoodsSold,
          description: `Inventory reduction for Invoice ${input.invoiceNumber}`,
        }
      );
    }

    const entry = await journalEntryService.createDraftEntry(journalEntryInput);

    // Auto-post the entry
    await journalEntryService.postEntry({
      tenantId: input.tenantId,
      entryId: entry.id,
      postedBy: input.createdBy || 'system',
    });

    return entry;
  }

  /**
   * Create accounting entry for purchase invoice
   * Debit: Inventory
   * Credit: Accounts Payable
   */
  async recordPurchase(input: PurchaseAccountingInput) {
    // Get current open period if not provided
    let periodId = input.accountingPeriodId;
    let fiscalYearId = input.fiscalYearId;

    if (!periodId) {
      const openPeriod = await accountingPeriodService.getCurrentOpenPeriod(input.tenantId, input.purchaseDate);
      if (openPeriod) {
        periodId = openPeriod.id;
        fiscalYearId = openPeriod.fiscalYearId;
      }
    }

    const journalEntryInput: CreateJournalEntryInput = {
      tenantId: input.tenantId,
      entryDate: input.purchaseDate,
      description: `Purchase Invoice ${input.purchaseNumber} - Supplier ${input.supplierId}`,
      referenceType: 'PurchaseInvoice',
      referenceId: input.purchaseId,
      fiscalYearId,
      accountingPeriodId: periodId,
      sourceEventId: input.sourceEventId,
      correlationId: input.correlationId,
      createdBy: input.createdBy,
      lines: [
        {
          accountCode: '1030', // Inventory
          debit: input.total,
          credit: 0,
          description: `Purchase from Supplier ${input.supplierId}`,
        },
        {
          accountCode: '2010', // Accounts Payable
          debit: 0,
          credit: input.total,
          description: `Supplier: ${input.supplierId}`,
        },
      ],
    };

    const entry = await journalEntryService.createDraftEntry(journalEntryInput);

    // Auto-post the entry
    await journalEntryService.postEntry({
      tenantId: input.tenantId,
      entryId: entry.id,
      postedBy: input.createdBy || 'system',
    });

    return entry;
  }

  /**
   * Create accounting entry for payment received
   * Debit: Cash/Bank
   * Credit: Accounts Receivable (or Debit Accounts Payable for supplier payments)
   */
  async recordPayment(input: PaymentAccountingInput) {
    // Get current open period if not provided
    let periodId = input.accountingPeriodId;
    let fiscalYearId = input.fiscalYearId;

    if (!periodId) {
      const openPeriod = await accountingPeriodService.getCurrentOpenPeriod(input.tenantId, input.paymentDate);
      if (openPeriod) {
        periodId = openPeriod.id;
        fiscalYearId = openPeriod.fiscalYearId;
      }
    }

    const journalEntryInput: CreateJournalEntryInput = {
      tenantId: input.tenantId,
      entryDate: input.paymentDate,
      description: input.customerId
        ? `Payment received - Customer ${input.customerId}`
        : `Payment made - Supplier ${input.supplierId}`,
      referenceType: 'Payment',
      referenceId: input.paymentId,
      fiscalYearId,
      accountingPeriodId: periodId,
      sourceEventId: input.sourceEventId,
      correlationId: input.correlationId,
      createdBy: input.createdBy,
      lines: [],
    };

    if (input.customerId) {
      // Customer payment
      journalEntryInput.lines = [
        {
          accountCode: '1011', // Cash
          debit: input.amount,
          credit: 0,
          description: `Payment from Customer ${input.customerId}`,
        },
        {
          accountCode: '1020', // Accounts Receivable
          debit: 0,
          credit: input.amount,
          description: `Customer: ${input.customerId}`,
        },
      ];
    } else if (input.supplierId) {
      // Supplier payment
      journalEntryInput.lines = [
        {
          accountCode: '2010', // Accounts Payable
          debit: input.amount,
          credit: 0,
          description: `Payment to Supplier ${input.supplierId}`,
        },
        {
          accountCode: '1011', // Cash
          debit: 0,
          credit: input.amount,
          description: `Payment to Supplier ${input.supplierId}`,
        },
      ];
    }

    const entry = await journalEntryService.createDraftEntry(journalEntryInput);

    // Auto-post the entry
    await journalEntryService.postEntry({
      tenantId: input.tenantId,
      entryId: entry.id,
      postedBy: input.createdBy || 'system',
    });

    return entry;
  }

  /**
   * Get account balance
   * Returns real-time or cached balance
   */
  async getAccountBalance(
    accountCode: string,
    tenantId: string,
    options: {
      asOfDate?: Date;
      fiscalYearId?: string;
      accountingPeriodId?: string;
      useCache?: boolean;
    } = {}
  ): Promise<AccountBalance> {
    // TODO: Re-enable when chartOfAccountsService is fixed for schema
    // const account = await chartOfAccountsService.getAccount(accountCode, tenantId);
    const account = await prisma.account.findUnique({
      where: { tenantId_code: { tenantId, code: accountCode } },
    });

    if (!account) {
      throw new Error(`Account ${accountCode} not found`);
    }

    // Try to get cached balance
    if (options.useCache !== false) {
      const cachedBalance = await (prisma as any).accountBalance.findUnique({
        where: {
          tenantId_accountCode_fiscalYearId_accountingPeriodId: {
            tenantId,
            accountCode,
            fiscalYearId: options.fiscalYearId || null,
            accountingPeriodId: options.accountingPeriodId || null,
          },
        },
      });

      if (cachedBalance) {
        return {
          accountCode: cachedBalance.accountCode,
          accountName: account.nameAr,
          accountType: account.type,
          balance: Number(cachedBalance.balance),
          debitTotal: Number(cachedBalance.debitTotal),
          creditTotal: Number(cachedBalance.creditTotal),
          asOfDate: cachedBalance.asOfDate,
        };
      }
    }

    // Calculate real-time balance
    const balance = await this.calculateRealTimeBalance(
      accountCode,
      tenantId,
      options.asOfDate,
      options.fiscalYearId,
      options.accountingPeriodId
    );

    return {
      accountCode: account.code,
      accountName: account.nameAr,
      accountType: account.type,
      balance: balance.balance,
      debitTotal: balance.debitTotal,
      creditTotal: balance.creditTotal,
      asOfDate: options.asOfDate || new Date(),
    };
  }

  /**
   * Get balances for multiple accounts
   */
  async getAccountBalances(
    accountCodes: string[],
    tenantId: string,
    options: {
      asOfDate?: Date;
      fiscalYearId?: string;
      accountingPeriodId?: string;
    } = {}
  ): Promise<AccountBalance[]> {
    const balances: AccountBalance[] = [];

    for (const code of accountCodes) {
      try {
        const balance = await this.getAccountBalance(code, tenantId, options);
        balances.push(balance);
      } catch (error) {
        console.error(`Error getting balance for account ${code}:`, error);
      }
    }

    return balances;
  }

  /**
   * Get trial balance
   * Sum of all debit and credit balances
   */
  async getTrialBalance(
    tenantId: string,
    options: {
      asOfDate?: Date;
      fiscalYearId?: string;
      accountingPeriodId?: string;
    } = {}
  ) {
    // TODO: Re-enable when chartOfAccountsService is fixed for schema
    // const accounts = await chartOfAccountsService.listAccounts(tenantId, { isActive: true });
    const accounts = await prisma.account.findMany({
      where: { tenantId, isActive: true },
    });

    const balances = await this.getAccountBalances(
      accounts.map((a: any) => a.code),
      tenantId,
      options
    );

    const totalDebit = balances
      .filter(b => b.balance > 0)
      .reduce((sum, b) => sum + b.balance, 0);

    const totalCredit = balances
      .filter(b => b.balance < 0)
      .reduce((sum, b) => sum + Math.abs(b.balance), 0);

    return {
      accounts: balances,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  /**
   * Rebuild account balance from journal entries
   * Used to fix corrupted balances or after data migration
   */
  async rebuildBalance(
    accountCode: string,
    tenantId: string,
    options: {
      asOfDate?: Date;
      fiscalYearId?: string;
      accountingPeriodId?: string;
    } = {}
  ) {
    const where: any = {
      tenantId,
      accountCode,
    };

    if (options.asOfDate) {
      where.journalEntry = {
        entryDate: { lte: options.asOfDate },
      };
    }

    if (options.fiscalYearId) {
      where.journalEntry = {
        ...where.journalEntry,
        fiscalYearId: options.fiscalYearId,
      };
    }

    if (options.accountingPeriodId) {
      where.journalEntry = {
        ...where.journalEntry,
        accountingPeriodId: options.accountingPeriodId,
      };
    }

    const lines = await (prisma as any).journalEntryLine.findMany({
      where,
      include: {
        journalEntry: true,
      },
    });

    const debitTotal = lines.reduce((sum: number, line: any) => sum + Number(line.debit), 0);
    const creditTotal = lines.reduce((sum: number, line: any) => sum + Number(line.credit), 0);
    const balance = debitTotal - creditTotal;

    // Update or create balance record
    const existingBalance = await (prisma as any).accountBalance.findUnique({
      where: {
        tenantId_accountCode_fiscalYearId_accountingPeriodId: {
          tenantId,
          accountCode,
          fiscalYearId: options.fiscalYearId || null,
          accountingPeriodId: options.accountingPeriodId || null,
        },
      },
    });

    if (existingBalance) {
      return await (prisma as any).accountBalance.update({
        where: { id: existingBalance.id },
        data: {
          balance,
          debitTotal,
          creditTotal,
          asOfDate: options.asOfDate || new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      return await (prisma as any).accountBalance.create({
        data: {
          tenantId,
          accountCode,
          fiscalYearId: options.fiscalYearId,
          accountingPeriodId: options.accountingPeriodId,
          balance,
          debitTotal,
          creditTotal,
          asOfDate: options.asOfDate || new Date(),
        },
      });
    }
  }

  /**
   * Calculate real-time balance from journal entries
   */
  private async calculateRealTimeBalance(
    accountCode: string,
    tenantId: string,
    asOfDate?: Date,
    fiscalYearId?: string,
    accountingPeriodId?: string
  ): Promise<{ balance: number; debitTotal: number; creditTotal: number }> {
    const where: any = {
      tenantId,
      accountCode,
      journalEntry: {
        status: 'POSTED',
      },
    };

    if (asOfDate) {
      where.journalEntry.entryDate = { lte: asOfDate };
    }

    if (fiscalYearId) {
      where.journalEntry.fiscalYearId = fiscalYearId;
    }

    if (accountingPeriodId) {
      where.journalEntry.accountingPeriodId = accountingPeriodId;
    }

    const result = await (prisma as any).journalEntryLine.aggregate({
      where,
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const debitTotal = Number(result._sum.debit || 0);
    const creditTotal = Number(result._sum.credit || 0);
    const balance = debitTotal - creditTotal;

    return { balance, debitTotal, creditTotal };
  }
}

export const accountingService = new AccountingService();
