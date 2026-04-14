/**
 * Accounting business logic and posting utilities
 * Handles journal entry generation from invoices and expenses
 * All entries follow double-entry bookkeeping principles
 */

import { prisma } from './db';
import { formatDate } from './format';

export interface JournalEntryInput {
  entryDate: Date;
  description: string;
  referenceType: string; // SalesInvoice, PurchaseInvoice, Expense
  referenceId: string;
  lines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
}

/**
 * Default chart of accounts in Arabic ERP system
 */
export const chartOfAccounts = {
  // Assets - الأصول
  '1001': { nameAr: 'النقد وما يعادله', nameEn: 'Cash & Equivalents', type: 'Asset', subType: 'Cash' },
  '1010': { nameAr: 'حساب بنكي', nameEn: 'Bank Account', type: 'Asset', subType: 'Bank' },
  '1020': { nameAr: 'المستحقات من العملاء', nameEn: 'Accounts Receivable', type: 'Asset', subType: 'Receivable' },
  '1030': { nameAr: 'المخزون', nameEn: 'Inventory', type: 'Asset', subType: 'Inventory' },
  '1040': { nameAr: 'الممتلكات والمنشآت والمعدات', nameEn: 'Fixed Assets', type: 'Asset', subType: 'FixedAsset' },

  // Liabilities - الالتزامات
  '2010': { nameAr: 'المستحقات للموردين', nameEn: 'Accounts Payable', type: 'Liability', subType: 'Payable' },
  '2020': { nameAr: 'قرض قصير الأجل', nameEn: 'Short-term Loan', type: 'Liability', subType: 'Loan' },
  '2030': { nameAr: 'ضريبة المبيعات المستحقة', nameEn: 'Sales Tax Payable', type: 'Liability', subType: 'Tax' },

  // Equity - حقوق الملكية
  '3010': { nameAr: 'رأس المال', nameEn: 'Capital', type: 'Equity', subType: 'Capital' },
  '3020': { nameAr: 'الأرباح المحتفظ بها', nameEn: 'Retained Earnings', type: 'Equity', subType: 'Retained' },

  // Revenue - الإيرادات
  '4010': { nameAr: 'إيرادات المبيعات', nameEn: 'Sales Revenue', type: 'Revenue', subType: 'Sales' },
  '4020': { nameAr: 'خصم المبيعات', nameEn: 'Sales Discount', type: 'Revenue', subType: 'Discount' },

  // Expenses - المصروفات
  '5010': { nameAr: 'تكلفة البضاعة المباعة', nameEn: 'Cost of Goods Sold', type: 'Expense', subType: 'COGS' },
  '5020': { nameAr: 'رواتب الموظفين', nameEn: 'Salaries', type: 'Expense', subType: 'Operating' },
  '5030': { nameAr: 'مصروفات الإيجار', nameEn: 'Rent', type: 'Expense', subType: 'Operating' },
  '5040': { nameAr: 'مصروفات الكهرباء والماء', nameEn: 'Utilities', type: 'Expense', subType: 'Operating' },
  '5050': { nameAr: 'مصروفات التسويق والإعلان', nameEn: 'Marketing', type: 'Expense', subType: 'Operating' },
  '5060': { nameAr: 'مصروفات متنوعة', nameEn: 'Miscellaneous', type: 'Expense', subType: 'Operating' },

  // Manufacturing - الإنتاج
  '6001': { nameAr: 'الإنتاج قيد التنفيذ (WIP)', nameEn: 'Work In Progress', type: 'Asset', subType: 'WIP' },
};

/**
 * Seed the chart of accounts into the database
 */
export async function seedChartOfAccounts() {
  try {
    for (const [code, account] of Object.entries(chartOfAccounts)) {
      await prisma.account.upsert({
        where: { code },
        update: {},
        create: {
          code,
          nameAr: account.nameAr,
          nameEn: account.nameEn,
          type: account.type,
          subType: account.subType,
          isActive: true,
        },
      });
    }
    console.log('Chart of Accounts seeded successfully');
  } catch (error) {
    console.error('Error seeding chart of accounts:', error);
  }
}

/**
 * Generate a unique journal entry number
 */
export async function generateEntryNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const count = await prisma.journalEntry.count({
    where: {
      entryDate: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
      },
    },
  });
  return `JE-${dateStr}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Create a journal entry with validation
 */
export async function createJournalEntry(entry: JournalEntryInput): Promise<any> {
  try {
    // Validate that debits equal credits
    const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `دفاتر غير متوازنة: الديون (${totalDebit}) لا تساوي الأرصدة (${totalCredit})`
      );
    }

    const entryNumber = await generateEntryNumber();

    // Create journal entry with lines in transaction
    const journalEntry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        entryDate: entry.entryDate,
        description: entry.description,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        totalDebit,
        totalCredit,
        isPosted: false,
        lines: {
          create: entry.lines,
        },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    console.log(`Journal entry created: ${entryNumber}`);
    return journalEntry;
  } catch (error) {
    console.error('Error creating journal entry:', error);
    throw error;
  }
}

/**
 * Post a journal entry (mark as permanent record)
 */
export async function postJournalEntry(entryId: string): Promise<any> {
  try {
    const journalEntry = await prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        isPosted: true,
        postedDate: new Date(),
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    // Update account balances using correct sign convention per account type:
    //   Debit-normal (Asset, Expense):          balance increases with debits
    //   Credit-normal (Liability, Equity, Revenue): balance increases with credits
    for (const line of journalEntry.lines) {
      const accountType = (line as any).account?.type ?? '';
      const isCreditNormal = ['Liability', 'Equity', 'Revenue'].includes(accountType);
      const balanceChange = isCreditNormal
        ? Number(line.credit) - Number(line.debit)
        : Number(line.debit) - Number(line.credit);

      await prisma.account.update({
        where: { code: line.accountCode },
        data: {
          balance: {
            increment: balanceChange,
          },
        },
      });
    }

    console.log(`Journal entry posted: ${journalEntry.entryNumber}`);
    return journalEntry;
  } catch (error) {
    console.error('Error posting journal entry:', error);
    throw error;
  }
}

/**
 * Generate journal entry for a sales invoice
 * Sales invoice booking:
 *   DR Receivables (1020)    CR Sales Revenue (4010)   — for the sale price
 *   DR COGS (5010)           CR Inventory (1030)        — for the cost of goods sold
 */
export async function createSalesInvoiceEntry(invoiceId: string, totalAmount: number): Promise<any> {
  try {
    // Fetch invoice items with product costs to calculate COGS
    const invoiceItems = await prisma.salesInvoiceItem.findMany({
      where: { salesInvoiceId: invoiceId },
      include: { product: { select: { cost: true } } },
    });

    const totalCOGS = invoiceItems.reduce((sum, item) => {
      const cost = item.product?.cost ?? 0;
      return sum + item.quantity * cost;
    }, 0);

    const lines: JournalEntryInput['lines'] = [
      {
        accountCode: '1020', // Receivables
        debit: totalAmount,
        credit: 0,
        description: 'المستحقات من العملاء',
      },
      {
        accountCode: '4010', // Sales Revenue
        debit: 0,
        credit: totalAmount,
        description: 'إيرادات المبيعات',
      },
    ];

    // Only add COGS entry if there is a measurable cost
    if (totalCOGS > 0) {
      lines.push(
        {
          accountCode: '5010', // COGS
          debit: totalCOGS,
          credit: 0,
          description: 'تكلفة البضاعة المباعة',
        },
        {
          accountCode: '1030', // Inventory
          debit: 0,
          credit: totalCOGS,
          description: 'تخفيض المخزون عند البيع',
        }
      );
    }

    const entry: JournalEntryInput = {
      entryDate: new Date(),
      description: `فاتورة بيع #${invoiceId}`,
      referenceType: 'SalesInvoice',
      referenceId: invoiceId,
      lines,
    };

    return await createJournalEntry(entry);
  } catch (error) {
    console.error('Error creating sales invoice entry:', error);
    // Don't throw - let invoice creation succeed even if accounting fails
    return null;
  }
}

/**
 * Generate journal entry for a purchase invoice
 * Purchase invoice booking:
 *   DR Inventory/COGS    CR Payables
 */
export async function createPurchaseInvoiceEntry(invoiceId: string, totalAmount: number): Promise<any> {
  try {
    const entry: JournalEntryInput = {
      entryDate: new Date(),
      description: `فاتورة شراء #${invoiceId}`,
      referenceType: 'PurchaseInvoice',
      referenceId: invoiceId,
      lines: [
        {
          accountCode: '1030', // Inventory / COGS
          debit: totalAmount,
          credit: 0,
          description: 'المخزون / تكلفة البضاعة المباعة',
        },
        {
          accountCode: '2010', // Payables
          debit: 0,
          credit: totalAmount,
          description: 'المستحقات للموردين',
        },
      ],
    };

    return await createJournalEntry(entry);
  } catch (error) {
    console.error('Error creating purchase invoice entry:', error);
    // Don't throw - let invoice creation succeed even if accounting fails
    return null;
  }
}

/**
 * Generate journal entry for an expense
 * Expense booking:
 *   DR Expense Category    CR Cash
 */
export async function createExpenseEntry(expenseId: string, amount: number, expenseType: string): Promise<any> {
  try {
    // Map expense type to account code
    const expenseAccountMap: Record<string, string> = {
      salaries: '5020',
      rent: '5030',
      utilities: '5040',
      marketing: '5050',
      other: '5060',
    };

    const accountCode = expenseAccountMap[expenseType] || '5060';

    const entry: JournalEntryInput = {
      entryDate: new Date(),
      description: `مصروف #${expenseId}`,
      referenceType: 'Expense',
      referenceId: expenseId,
      lines: [
        {
          accountCode,
          debit: amount,
          credit: 0,
          description: `مصروف: ${expenseType}`,
        },
        {
          accountCode: '1001', // Cash
          debit: 0,
          credit: amount,
          description: 'النقد وما يعادله',
        },
      ],
    };

    return await createJournalEntry(entry);
  } catch (error) {
    console.error('Error creating expense entry:', error);
    // Don't throw - let expense creation succeed even if accounting fails
    return null;
  }
}

/**
 * Generate journal entry for manufacturing completion
 * When production order is completed:
 *   DR Finished Goods (Inventory)    CR Work In Progress
 * Then:
 *   DR Work In Progress              CR Raw Materials (already consumed)
 *                                    CR Labor (already expensed)
 *                                    CR Overhead (already allocated)
 */
export async function createManufacturingEntry(
  productionOrderId: string,
  finishedGoodsQuantity: number,
  totalManufacturingCost: number
): Promise<any> {
  try {
    const entry: JournalEntryInput = {
      entryDate: new Date(),
      description: `أمر إنتاج مكتمل #${productionOrderId}`,
      referenceType: 'ProductionOrder',
      referenceId: productionOrderId,
      lines: [
        {
          accountCode: '1030', // Inventory/Finished Goods
          debit: totalManufacturingCost,
          credit: 0,
          description: 'البضائع المنتجة (المخزون)',
        },
        {
          accountCode: '6001', // WIP (Work In Progress) - create this account
          debit: 0,
          credit: totalManufacturingCost,
          description: 'تحويل من الإنتاج قيد التنفيذ',
        },
      ],
    };

    return await createJournalEntry(entry);
  } catch (error) {
    console.error('Error creating manufacturing entry:', error);
    return null;
  }
}

/**
 * Record raw materials consumed in manufacturing
 * When production order starts:
 *   DR Work In Progress    CR Inventory (raw materials)
 */
export async function recordRawMaterialConsumption(
  productionOrderId: string,
  rawMaterialsCost: number,
  items: Array<{ productId: string; quantity: number }>
): Promise<any> {
  try {
    const entry: JournalEntryInput = {
      entryDate: new Date(),
      description: `استهلاك مواد خام - أمر إنتاج #${productionOrderId}`,
      referenceType: 'ProductionOrder',
      referenceId: productionOrderId,
      lines: [
        {
          accountCode: '6001', // WIP
          debit: rawMaterialsCost,
          credit: 0,
          description: 'المواد الخام المستهلكة',
        },
        {
          accountCode: '1030', // Inventory
          debit: 0,
          credit: rawMaterialsCost,
          description: 'تخفيض المخزون من المواد الخام',
        },
      ],
    };

    return await createJournalEntry(entry);
  } catch (error) {
    console.error('Error recording material consumption:', error);
    return null;
  }
}

/**
 * Record labor costs in manufacturing
 *   DR Work In Progress    CR Labor Expense (or Payable if accrued)
 */
export async function recordManufacturingLabor(
  productionOrderId: string,
  laborCost: number
): Promise<any> {
  try {
    const entry: JournalEntryInput = {
      entryDate: new Date(),
      description: `تكاليف العمل - أمر إنتاج #${productionOrderId}`,
      referenceType: 'ProductionOrder',
      referenceId: productionOrderId,
      lines: [
        {
          accountCode: '6001', // WIP
          debit: laborCost,
          credit: 0,
          description: 'تكاليف العمل المباشرة',
        },
        {
          accountCode: '5020', // Salaries/Labor Expense
          debit: 0,
          credit: laborCost,
          description: 'تكاليف العمل المصروفة',
        },
      ],
    };

    return await createJournalEntry(entry);
  } catch (error) {
    console.error('Error recording labor costs:', error);
    return null;
  }
}

/**
 * Record overhead allocation in manufacturing
 *   DR Work In Progress    CR Overhead Expense (or Payable)
 */
export async function recordManufacturingOverhead(
  productionOrderId: string,
  overheadCost: number
): Promise<any> {
  try {
    const entry: JournalEntryInput = {
      entryDate: new Date(),
      description: `تكاليف عامة - أمر إنتاج #${productionOrderId}`,
      referenceType: 'ProductionOrder',
      referenceId: productionOrderId,
      lines: [
        {
          accountCode: '6001', // WIP
          debit: overheadCost,
          credit: 0,
          description: 'تكاليف عامة مخصصة',
        },
        {
          accountCode: '5060', // Overhead/Miscellaneous
          debit: 0,
          credit: overheadCost,
          description: 'تكاليف عامة مصروفة',
        },
      ],
    };

    return await createJournalEntry(entry);
  } catch (error) {
    console.error('Error recording overhead costs:', error);
    return null;
  }
}

/**
 * Calculate P&L (Profit & Loss) statement
 */
export async function calculateProfitAndLoss(
  fromDate: Date,
  toDate: Date
): Promise<{
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
}> {
  try {
    // Get all revenue and expense accounts
    const revenueAccount = await prisma.journalEntryLine.aggregate({
      where: {
        account: { type: 'Revenue' },
        journalEntry: {
          entryDate: { gte: fromDate, lte: toDate },
          isPosted: true,
        },
      },
      _sum: { credit: true },
    });

    const cogsAccount = await prisma.journalEntryLine.aggregate({
      where: {
        account: { subType: 'COGS' },
        journalEntry: {
          entryDate: { gte: fromDate, lte: toDate },
          isPosted: true,
        },
      },
      _sum: { debit: true },
    });

    const operatingExpensesAccount = await prisma.journalEntryLine.aggregate({
      where: {
        account: { 
          type: 'Expense',
          subType: 'Operating',
        },
        journalEntry: {
          entryDate: { gte: fromDate, lte: toDate },
          isPosted: true,
        },
      },
      _sum: { debit: true },
    });

    const revenue = Number(revenueAccount._sum.credit) || 0;
    const cogs = Number(cogsAccount._sum.debit) || 0;
    const operatingExpenses = Number(operatingExpensesAccount._sum.debit) || 0;
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - operatingExpenses;

    return {
      revenue,
      cogs,
      grossProfit,
      operatingExpenses,
      netProfit,
    };
  } catch (error) {
    console.error('Error calculating P&L:', error);
    return {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      operatingExpenses: 0,
      netProfit: 0,
    };
  }
}

/**
 * Get trial balance
 */
export async function getTrialBalance(): Promise<
  Array<{
    code: string;
    nameAr: string;
    debit: number;
    credit: number;
  }>
> {
  try {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      include: {
        journalLines: {
          where: {
            journalEntry: { isPosted: true },
          },
        },
      },
    });

    return accounts.map((account) => {
      const totalDebit = account.journalLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
      const totalCredit = account.journalLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);

      return {
        code: account.code,
        nameAr: account.nameAr,
        debit: totalDebit,
        credit: totalCredit,
      };
    });
  } catch (error) {
    console.error('Error getting trial balance:', error);
    return [];
  }
}
