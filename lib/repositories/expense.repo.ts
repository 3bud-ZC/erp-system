/**
 * Expense Repository
 * Pure Prisma reads for the Expense entity. Writes stay in the route because
 * they are wrapped in $transaction with cross-table side-effects (journal entries).
 */
import { prisma } from '@/lib/db';

export const expenseRepo = {
  listAll() {
    return prisma.expense.findMany({ orderBy: { createdAt: 'desc' } });
  },

  findById(id: string) {
    return prisma.expense.findUnique({ where: { id } });
  },
};
