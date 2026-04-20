import { prisma } from './db';

/**
 * Calculate customer balance dynamically
 * Returns total invoices, total payments, and remaining balance
 */
export async function getCustomerBalance(customerId: string) {
  const [totalInvoices, totalPayments] = await Promise.all([
    prisma.salesInvoice.aggregate({
      where: { customerId },
      _sum: { total: true }
    }),
    prisma.payment.aggregate({
      where: { customerId },
      _sum: { amount: true }
    })
  ]);

  const total = totalInvoices._sum.total || 0;
  const paid = totalPayments._sum.amount || 0;
  const remaining = total - paid;

  return {
    total,
    paid,
    remaining
  };
}

/**
 * Calculate supplier balance dynamically
 * Returns total invoices, total payments, and remaining balance
 */
export async function getSupplierBalance(supplierId: string) {
  const [totalInvoices, totalPayments] = await Promise.all([
    prisma.purchaseInvoice.aggregate({
      where: { supplierId },
      _sum: { total: true }
    }),
    prisma.payment.aggregate({
      where: { supplierId },
      _sum: { amount: true }
    })
  ]);

  const total = totalInvoices._sum.total || 0;
  const paid = totalPayments._sum.amount || 0;
  const remaining = total - paid;

  return {
    total,
    paid,
    remaining
  };
}

/**
 * Get balances for multiple customers (optimized batch query)
 */
export async function getMultipleCustomerBalances(customerIds: string[]) {
  const balances = await Promise.all(
    customerIds.map(id => getCustomerBalance(id))
  );

  return customerIds.reduce((acc, id, index) => {
    acc[id] = balances[index];
    return acc;
  }, {} as Record<string, { total: number; paid: number; remaining: number }>);
}

/**
 * Get balances for multiple suppliers (optimized batch query)
 */
export async function getMultipleSupplierBalances(supplierIds: string[]) {
  const balances = await Promise.all(
    supplierIds.map(id => getSupplierBalance(id))
  );

  return supplierIds.reduce((acc, id, index) => {
    acc[id] = balances[index];
    return acc;
  }, {} as Record<string, { total: number; paid: number; remaining: number }>);
}

/**
 * Get cashbox/ treasury balance
 * Uses journal entries with cash accounts (1001: Cash, 1010: Bank)
 */
export async function getCashboxBalance(dateFrom?: Date, dateTo?: Date) {
  const where: any = {
    journalEntry: {
      isPosted: true,
    },
    accountCode: {
      in: ['1001', '1010'], // Cash and Bank accounts
    },
  };
  if (dateFrom || dateTo) {
    where.journalEntry.entryDate = {};
    if (dateFrom) where.journalEntry.entryDate.gte = dateFrom;
    if (dateTo) where.journalEntry.entryDate.lte = dateTo;
  }

  const [totalDebit, totalCredit] = await Promise.all([
    prisma.journalEntryLine.aggregate({
      where: { ...where },
      _sum: { debit: true }
    }),
    prisma.journalEntryLine.aggregate({
      where: { ...where },
      _sum: { credit: true }
    })
  ]);

  const debitAmount = Number(totalDebit._sum.debit) || 0;
  const creditAmount = Number(totalCredit._sum.credit) || 0;
  const balance = debitAmount - creditAmount; // Cash accounts are debit-normal

  return {
    in: debitAmount,
    out: creditAmount,
    balance
  };
}
