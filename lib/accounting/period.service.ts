/**
 * Accounting Period Service
 * Manages fiscal years and accounting periods
 */

import { prisma } from '../db';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateFiscalYearInput {
  tenantId: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface CreateAccountingPeriodInput {
  tenantId: string;
  fiscalYearId: string;
  name: string;
  periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
  startDate: Date;
  endDate: Date;
}

export interface ClosePeriodInput {
  tenantId: string;
  periodId: string;
  closedBy: string;
}

// ============================================================================
// ACCOUNTING PERIOD SERVICE
// ============================================================================

export class AccountingPeriodService {
  /**
   * Create a fiscal year
   */
  async createFiscalYear(input: CreateFiscalYearInput) {
    // Validate date order
    if (input.startDate >= input.endDate) {
      throw new Error('Start date must be before end date');
    }

    // Check for overlapping fiscal years
    const overlapping = await (prisma as any).fiscalYear.findFirst({
      where: {
        tenantId: input.tenantId,
        isClosed: false,
        OR: [
          {
            AND: [
              { startDate: { lte: input.startDate } },
              { endDate: { gte: input.startDate } },
            ],
          },
          {
            AND: [
              { startDate: { lte: input.endDate } },
              { endDate: { gte: input.endDate } },
            ],
          },
          {
            AND: [
              { startDate: { gte: input.startDate } },
              { endDate: { lte: input.endDate } },
            ],
          },
        ],
      },
    });

    if (overlapping) {
      throw new Error(`Fiscal year overlaps with existing fiscal year ${overlapping.name}`);
    }

    return await (prisma as any).fiscalYear.create({
      data: input,
    });
  }

  /**
   * Create an accounting period
   */
  async createAccountingPeriod(input: CreateAccountingPeriodInput) {
    // Validate fiscal year exists
    const fiscalYear = await (prisma as any).fiscalYear.findUnique({
      where: {
        id: input.fiscalYearId,
      },
    });

    if (!fiscalYear || fiscalYear.tenantId !== input.tenantId) {
      throw new Error('Fiscal year not found or belongs to different tenant');
    }

    // Validate period dates are within fiscal year
    if (input.startDate < fiscalYear.startDate || input.endDate > fiscalYear.endDate) {
      throw new Error('Period dates must be within fiscal year dates');
    }

    // Validate date order
    if (input.startDate >= input.endDate) {
      throw new Error('Start date must be before end date');
    }

    // Check for overlapping periods
    const overlapping = await (prisma as any).accountingPeriod.findFirst({
      where: {
        tenantId: input.tenantId,
        fiscalYearId: input.fiscalYearId,
        status: 'OPEN',
        OR: [
          {
            AND: [
              { startDate: { lte: input.startDate } },
              { endDate: { gte: input.startDate } },
            ],
          },
          {
            AND: [
              { startDate: { lte: input.endDate } },
              { endDate: { gte: input.endDate } },
            ],
          },
          {
            AND: [
              { startDate: { gte: input.startDate } },
              { endDate: { lte: input.endDate } },
            ],
          },
        ],
      },
    });

    if (overlapping) {
      throw new Error(`Period overlaps with existing period ${overlapping.name}`);
    }

    return await (prisma as any).accountingPeriod.create({
      data: input,
    });
  }

  /**
   * Close an accounting period
   * Prevents new journal entries from being posted to this period
   */
  async closePeriod(input: ClosePeriodInput) {
    const period = await (prisma as any).accountingPeriod.findUnique({
      where: {
        id: input.periodId,
      },
      include: {
        fiscalYear: true,
      },
    });

    if (!period || period.tenantId !== input.tenantId) {
      throw new Error('Accounting period not found or belongs to different tenant');
    }

    if (period.status !== 'OPEN') {
      throw new Error('Period is already closed');
    }

    // Check if there are any draft entries in this period
    const draftEntries = await (prisma as any).journalEntry.count({
      where: {
        tenantId: input.tenantId,
        accountingPeriodId: input.periodId,
        status: 'DRAFT',
      },
    });

    if (draftEntries > 0) {
      throw new Error(`Cannot close period with ${draftEntries} draft entries. Post or delete them first.`);
    }

    // Close period in transaction
    return await prisma.$transaction(async (tx) => {
      const closedPeriod = await (tx as any).accountingPeriod.update({
        where: { id: input.periodId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: input.closedBy,
        },
      });

      return closedPeriod;
    });
  }

  /**
   * Reopen a closed accounting period
   * Allows new entries to be posted to the period
   */
  async reopenPeriod(periodId: string, tenantId: string, reopenedBy: string) {
    const period = await (prisma as any).accountingPeriod.findUnique({
      where: {
        id: periodId,
      },
      include: {
        fiscalYear: true,
      },
    });

    if (!period || period.tenantId !== tenantId) {
      throw new Error('Accounting period not found or belongs to different tenant');
    }

    if (period.status !== 'CLOSED') {
      throw new Error('Period is not closed');
    }

    // Check if fiscal year is closed
    if (period.fiscalYear.isClosed) {
      throw new Error('Cannot reopen period when fiscal year is closed');
    }

    return await (prisma as any).accountingPeriod.update({
      where: { id: periodId },
      data: {
        status: 'OPEN',
        closedAt: null,
        closedBy: null,
      },
    });
  }

  /**
   * Get fiscal year by ID
   */
  async getFiscalYear(fiscalYearId: string, tenantId: string) {
    return await (prisma as any).fiscalYear.findUnique({
      where: {
        id: fiscalYearId,
      },
      include: {
        accountingPeriods: {
          orderBy: {
            startDate: 'asc',
          },
        },
      },
    });
  }

  /**
   * Get accounting period by ID
   */
  async getAccountingPeriod(periodId: string, tenantId: string) {
    return await (prisma as any).accountingPeriod.findUnique({
      where: {
        id: periodId,
      },
      include: {
        fiscalYear: true,
      },
    });
  }

  /**
   * List fiscal years for a tenant
   */
  async listFiscalYears(tenantId: string) {
    return await (prisma as any).fiscalYear.findMany({
      where: {
        tenantId,
      },
      include: {
        accountingPeriods: {
          orderBy: {
            startDate: 'asc',
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  /**
   * List accounting periods for a tenant
   */
  async listAccountingPeriods(tenantId: string, options: {
    fiscalYearId?: string;
    status?: 'OPEN' | 'CLOSED';
  } = {}) {
    const where: any = {
      tenantId,
    };

    if (options.fiscalYearId) {
      where.fiscalYearId = options.fiscalYearId;
    }

    if (options.status) {
      where.status = options.status;
    }

    return await (prisma as any).accountingPeriod.findMany({
      where,
      include: {
        fiscalYear: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  /**
   * Get current open period for a tenant
   */
  async getCurrentOpenPeriod(tenantId: string, date?: Date) {
    const targetDate = date || new Date();

    return await (prisma as any).accountingPeriod.findFirst({
      where: {
        tenantId,
        status: 'OPEN',
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
      },
      include: {
        fiscalYear: true,
      },
    });
  }

  /**
   * Auto-generate monthly periods for a fiscal year
   */
  async generateMonthlyPeriods(fiscalYearId: string, tenantId: string) {
    const fiscalYear = await this.getFiscalYear(fiscalYearId, tenantId);

    if (!fiscalYear) {
      throw new Error('Fiscal year not found');
    }

    const periods: any[] = [];
    let currentDate = new Date(fiscalYear.startDate);
    const endDate = new Date(fiscalYear.endDate);

    while (currentDate <= endDate) {
      const periodStartDate = new Date(currentDate);
      const periodEndDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      );

      // Ensure period doesn't exceed fiscal year
      if (periodEndDate > endDate) {
        periodEndDate.setTime(endDate.getTime());
      }

      const monthName = periodStartDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const period = await this.createAccountingPeriod({
        tenantId,
        fiscalYearId,
        name: monthName,
        periodType: 'MONTHLY',
        startDate: periodStartDate,
        endDate: periodEndDate,
      });

      periods.push(period);

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return periods;
  }

  /**
   * Close fiscal year
   * Closes all periods in the fiscal year
   */
  async closeFiscalYear(fiscalYearId: string, tenantId: string, closedBy: string) {
    const fiscalYear = await this.getFiscalYear(fiscalYearId, tenantId);

    if (!fiscalYear) {
      throw new Error('Fiscal year not found');
    }

    if (fiscalYear.isClosed) {
      throw new Error('Fiscal year is already closed');
    }

    // Check all periods are closed
    const openPeriods = fiscalYear.accountingPeriods.filter((p: any) => p.status === 'OPEN');
    if (openPeriods.length > 0) {
      throw new Error(`Cannot close fiscal year with ${openPeriods.length} open periods`);
    }

    // Close fiscal year
    return await (prisma as any).fiscalYear.update({
      where: { id: fiscalYearId },
      data: {
        isClosed: true,
        closedAt: new Date(),
        closedBy,
      },
    });
  }
}

export const accountingPeriodService = new AccountingPeriodService();
