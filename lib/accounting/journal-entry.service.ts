/**
 * Journal Entry Service
 * Manages journal entries with double-entry bookkeeping enforcement
 */

import { prisma } from '../db';

// ============================================================================
// TYPES
// ============================================================================

export interface JournalEntryLineInput {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
  lineNumber?: number;
  currencyId?: string;
  exchangeRate?: number;
}

export interface CreateJournalEntryInput {
  tenantId: string;
  entryDate: Date;
  description: string;
  referenceType?: string;
  referenceId?: string;
  lines?: JournalEntryLineInput[];
  fiscalYearId?: string;
  accountingPeriodId?: string;
  sourceEventId?: string;
  correlationId?: string;
  createdBy?: string;
}

export interface PostJournalEntryInput {
  tenantId: string;
  entryId: string;
  postedBy: string;
}

// ============================================================================
// JOURNAL ENTRY SERVICE
// ============================================================================

export class JournalEntryService {
  /**
   * Create a draft journal entry
   * Validates double-entry balance before creation
   */
  async createDraftEntry(input: CreateJournalEntryInput) {
    // Validate lines
    if (!input.lines || input.lines.length === 0) {
      throw new Error('Journal entry must have at least one line');
    }
    this.validateJournalEntryLines(input.lines);

    // Calculate totals
    const totals = this.calculateTotals(input.lines);

    // Check if accounting period is open
    if (input.accountingPeriodId) {
      await this.validatePeriodOpen(input.accountingPeriodId, input.tenantId);
    }

    // Generate entry number
    const entryNumber = await this.generateEntryNumber(input.tenantId);

    // Create journal entry with lines in a transaction
    return await prisma.$transaction(async (tx) => {
      const entry = await (tx as any).journalEntry.create({
        data: {
          tenantId: input.tenantId,
          entryNumber,
          entryDate: input.entryDate,
          description: input.description,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          totalDebit: totals.totalDebit,
          totalCredit: totals.totalCredit,
          status: 'DRAFT',
          fiscalYearId: input.fiscalYearId,
          accountingPeriodId: input.accountingPeriodId,
          sourceEventId: input.sourceEventId,
          correlationId: input.correlationId,
          createdBy: input.createdBy,
          lines: {
            create: (input.lines || []).map((line, index) => ({
              tenantId: input.tenantId,
              accountCode: line.accountCode,
              debit: line.debit,
              credit: line.credit,
              description: line.description,
              lineNumber: line.lineNumber || index + 1,
              amount: Math.abs(line.debit - line.credit),
              currencyId: line.currencyId,
              exchangeRate: line.exchangeRate,
            })),
          },
        },
      });

      return entry;
    });
  }

  /**
   * Post a draft journal entry
   * Makes the entry immutable and updates account balances
   */
  async postEntry(input: PostJournalEntryInput) {
    const entry = await (prisma as any).journalEntry.findUnique({
      where: {
        id: input.entryId,
      },
      include: {
        lines: true,
      },
    });

    if (!entry) {
      throw new Error(`Journal entry ${input.entryId} not found`);
    }

    if (entry.tenantId !== input.tenantId) {
      throw new Error(`Journal entry belongs to different tenant`);
    }

    if (entry.status !== 'DRAFT') {
      throw new Error(`Journal entry is not in draft status`);
    }

    // Validate accounting period is still open
    if (entry.accountingPeriodId) {
      await this.validatePeriodOpen(entry.accountingPeriodId, input.tenantId);
    }

    // Post entry and update balances in transaction
    return await prisma.$transaction(async (tx) => {
      // Update entry status
      const postedEntry = await (tx as any).journalEntry.update({
        where: { id: input.entryId },
        data: {
          status: 'POSTED',
          postedAt: new Date(),
          postedBy: input.postedBy,
        },
      });

      // Update account balances
      for (const line of entry.lines) {
        await this.updateAccountBalance(
          tx as any,
          line.accountCode,
          input.tenantId,
          line.debit,
          line.credit,
          entry.entryDate,
          entry.fiscalYearId,
          entry.accountingPeriodId,
          entry.id
        );
      }

      return postedEntry;
    });
  }

  /**
   * Reverse a posted journal entry
   * Creates a reversal entry with opposite amounts
   */
  async reverseEntry(entryId: string, tenantId: string, reason: string, reversedBy: string) {
    const entry = await (prisma as any).journalEntry.findUnique({
      where: {
        id: entryId,
      },
      include: {
        lines: true,
      },
    });

    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }

    if (entry.tenantId !== tenantId) {
      throw new Error(`Journal entry belongs to different tenant`);
    }

    if (entry.status !== 'POSTED') {
      throw new Error(`Can only reverse posted entries`);
    }

    if (entry.reversalEntryId) {
      throw new Error(`Entry already reversed`);
    }

    // Create reversal entry
    const reversalNumber = await this.generateEntryNumber(tenantId);
    const reversalDate = new Date();

    const reversal = await prisma.$transaction(async (tx) => {
      // Create reversal entry
      const reversalEntry = await (tx as any).journalEntry.create({
        data: {
          tenantId,
          entryNumber: `${reversalNumber}-REV`,
          entryDate: reversalDate,
          description: `Reversal of ${entry.entryNumber}: ${reason}`,
          referenceType: 'JournalEntryReversal',
          referenceId: entryId,
          totalDebit: entry.totalCredit,
          totalCredit: entry.totalDebit,
          status: 'POSTED',
          postedAt: reversalDate,
          postedBy: reversedBy,
          fiscalYearId: entry.fiscalYearId,
          accountingPeriodId: entry.accountingPeriodId,
          reversalEntryId: entry.id,
          createdBy: reversedBy,
          lines: {
            create: entry.lines.map((line: any) => ({
              tenantId,
              accountCode: line.accountCode,
              debit: line.credit, // Swap debit and credit
              credit: line.debit,
              description: line.description,
              lineNumber: line.lineNumber,
              amount: line.amount,
              currencyId: line.currencyId,
              exchangeRate: line.exchangeRate,
            })),
          },
        },
      });

      // Update original entry to mark as reversed
      await (tx as any).journalEntry.update({
        where: { id: entryId },
        data: {
          reversalEntryId: reversalEntry.id,
        },
      });

      // Update balances (reverse the original impact)
      for (const line of entry.lines) {
        await this.updateAccountBalance(
          tx as any,
          line.accountCode,
          tenantId,
          line.credit, // Reverse: credit becomes debit
          line.debit, // Reverse: debit becomes credit
          reversalDate,
          entry.fiscalYearId,
          entry.accountingPeriodId,
          reversalEntry.id
        );
      }

      return reversalEntry;
    });

    return reversal;
  }

  /**
   * Delete a draft journal entry. Posted entries can never be deleted —
   * they must be reversed instead (use `reverseEntry`).
   */
  async deleteDraftEntry(entryId: string, tenantId: string) {
    const entry = await (prisma as any).journalEntry.findUnique({
      where: { id: entryId },
      select: { id: true, tenantId: true, status: true },
    });

    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }
    if (entry.tenantId !== tenantId) {
      throw new Error(`Journal entry belongs to a different tenant`);
    }
    if (entry.status !== 'DRAFT') {
      throw new Error(`Only draft entries can be deleted; use reverse for posted entries`);
    }

    await prisma.$transaction(async (tx) => {
      await (tx as any).journalEntryLine.deleteMany({ where: { journalEntryId: entryId } });
      await (tx as any).journalEntry.delete({ where: { id: entryId } });
    });

    return { id: entryId, deleted: true };
  }

  /**
   * Update a draft journal entry. Replaces description / entryDate / lines.
   * Posted entries are immutable — callers must use `reverseEntry`.
   */
  async updateDraftEntry(
    entryId: string,
    tenantId: string,
    patch: {
      entryDate?: Date;
      description?: string;
      lines?: JournalEntryLineInput[];
    },
  ) {
    const entry = await (prisma as any).journalEntry.findUnique({
      where: { id: entryId },
      select: { id: true, tenantId: true, status: true },
    });

    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }
    if (entry.tenantId !== tenantId) {
      throw new Error(`Journal entry belongs to a different tenant`);
    }
    if (entry.status !== 'DRAFT') {
      throw new Error(`Only draft entries can be updated; use reverse for posted entries`);
    }

    if (patch.lines && patch.lines.length > 0) {
      this.validateJournalEntryLines(patch.lines);
    }

    return await prisma.$transaction(async (tx) => {
      // If lines were provided, replace them all.
      if (patch.lines && patch.lines.length > 0) {
        const totals = this.calculateTotals(patch.lines);
        await (tx as any).journalEntryLine.deleteMany({ where: { journalEntryId: entryId } });
        await (tx as any).journalEntry.update({
          where: { id: entryId },
          data: {
            entryDate: patch.entryDate,
            description: patch.description,
            totalDebit: totals.totalDebit,
            totalCredit: totals.totalCredit,
            lines: {
              create: patch.lines.map((line, index) => ({
                tenantId,
                accountCode: line.accountCode,
                debit: line.debit,
                credit: line.credit,
                description: line.description,
                lineNumber: line.lineNumber || index + 1,
                amount: Math.abs(line.debit - line.credit),
                currencyId: line.currencyId,
                exchangeRate: line.exchangeRate,
              })),
            },
          },
        });
      } else {
        // Just update header fields.
        await (tx as any).journalEntry.update({
          where: { id: entryId },
          data: {
            entryDate: patch.entryDate,
            description: patch.description,
          },
        });
      }

      return await (tx as any).journalEntry.findUnique({
        where: { id: entryId },
        include: { lines: true },
      });
    });
  }

  /**
   * Get journal entry by ID
   */
  async getEntry(entryId: string, tenantId: string) {
    return await (prisma as any).journalEntry.findUnique({
      where: {
        id: entryId,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
        fiscalYear: true,
        accountingPeriod: true,
        reversalEntry: true,
        reversedBy: true,
      },
    });
  }

  /**
   * List journal entries for a tenant
   */
  async listEntries(tenantId: string, options: {
    status?: 'DRAFT';
    startDate?: Date;
    endDate?: Date;
    referenceType?: string;
    referenceId?: string;
    fiscalYearId?: string;
    accountingPeriodId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const where: any = {
      tenantId,
    };

    if (options.status) {
      where.status = options.status;
    }

    if (options.startDate || options.endDate) {
      where.entryDate = {};
      if (options.startDate) {
        where.entryDate.gte = options.startDate;
      }
      if (options.endDate) {
        where.entryDate.lte = options.endDate;
      }
    }

    if (options.referenceType) {
      where.referenceType = options.referenceType;
    }

    if (options.referenceId) {
      where.referenceId = options.referenceId;
    }

    if (options.fiscalYearId) {
      where.fiscalYearId = options.fiscalYearId;
    }

    if (options.accountingPeriodId) {
      where.accountingPeriodId = options.accountingPeriodId;
    }

    const [entries, total] = await Promise.all([
      (prisma as any).journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: true,
            },
          },
          fiscalYear: true,
          accountingPeriod: true,
        },
        orderBy: {
          entryDate: 'desc',
        },
        take: options.limit || 50,
        skip: options.offset || 0,
      }),
      (prisma as any).journalEntry.count({ where }),
    ]);

    return { entries, total };
  }

  /**
   * Validate journal entry lines
   */
  private validateJournalEntryLines(lines: JournalEntryLineInput[]): void {
    if (lines.length < 2) {
      throw new Error('Journal entry must have at least 2 lines');
    }

    for (const line of lines) {
      if (!line.accountCode) {
        throw new Error('Account code is required');
      }

      if (line.debit < 0 || line.credit < 0) {
        throw new Error('Debit and credit cannot be negative');
      }

      if (line.debit > 0 && line.credit > 0) {
        throw new Error('Line cannot have both debit and credit');
      }

      if (line.debit === 0 && line.credit === 0) {
        throw new Error('Line must have either debit or credit');
      }
    }
  }

  /**
   * Calculate totals for journal entry
   */
  private calculateTotals(lines: JournalEntryLineInput[]) {
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw new Error(`Journal entry does not balance. Debit: ${totalDebit}, Credit: ${totalCredit}`);
    }

    return { totalDebit, totalCredit };
  }

  /**
   * Generate sequential entry number for tenant
   */
  private async generateEntryNumber(tenantId: string): Promise<string> {
    const lastEntry = await (prisma as any).journalEntry.findFirst({
      where: { tenantId },
      orderBy: {
        entryNumber: 'desc',
      },
      select: {
        entryNumber: true,
      },
    });

    let nextNumber = 1;
    if (lastEntry) {
      const lastNum = parseInt(lastEntry.entryNumber.replace(/\D/g, ''), 10);
      nextNumber = lastNum + 1;
    }

    return `JE${new Date().getFullYear()}${String(nextNumber).padStart(6, '0')}`;
  }

  /**
   * Validate accounting period is open
   */
  private async validatePeriodOpen(periodId: string, tenantId: string): Promise<void> {
    const period = await (prisma as any).accountingPeriod.findUnique({
      where: {
        id: periodId,
      },
    });

    if (!period || period.tenantId !== tenantId) {
      throw new Error(`Accounting period not found`);
    }

    if (period.status !== 'OPEN') {
      throw new Error(`Accounting period is closed. Cannot post entries.`);
    }
  }

  /**
   * Update account balance
   */
  private async updateAccountBalance(
    tx: any,
    accountCode: string,
    tenantId: string,
    debit: number,
    credit: number,
    asOfDate: Date,
    fiscalYearId?: string,
    accountingPeriodId?: string,
    entryId?: string
  ): Promise<void> {
    // Calculate balance change
    const balanceChange = debit - credit;

    // Try to update existing balance
    const existingBalance = await (tx as any).accountBalance.findUnique({
      where: {
        tenantId_accountCode_fiscalYearId_accountingPeriodId: {
          tenantId,
          accountCode,
          fiscalYearId: fiscalYearId || null,
          accountingPeriodId: accountingPeriodId || null,
        },
      },
    });

    if (existingBalance) {
      await (tx as any).accountBalance.update({
        where: {
          id: existingBalance.id,
        },
        data: {
          balance: { increment: balanceChange },
          debitTotal: { increment: debit },
          creditTotal: { increment: credit },
          asOfDate,
          lastEntryId: entryId,
          lastEntryDate: asOfDate,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new balance record
      await (tx as any).accountBalance.create({
        data: {
          tenantId,
          accountCode,
          fiscalYearId,
          accountingPeriodId,
          balance: balanceChange,
          debitTotal: debit,
          creditTotal: credit,
          asOfDate,
          lastEntryId: entryId,
          lastEntryDate: asOfDate,
        },
      });
    }
  }
}

export const journalEntryService = new JournalEntryService();
