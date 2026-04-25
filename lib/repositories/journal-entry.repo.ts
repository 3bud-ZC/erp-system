/**
 * Journal Entry Repository (READ-ONLY)
 * Only safe reads. Posting/reversal stays in the existing service files
 * (lib/accounting.ts) since those orchestrate balance updates.
 */
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

const listInclude = {
  lines: { include: { account: true } },
} as const;

export const journalEntryRepo = {
  listByWhere(where: Prisma.JournalEntryWhereInput, opts: { skip?: number; take?: number } = {}) {
    return Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: listInclude,
        orderBy: { entryDate: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.journalEntry.count({ where }),
    ]).then(([entries, total]) => ({ entries, total }));
  },

  findById(id: string) {
    return prisma.journalEntry.findUnique({
      where: { id },
      include: listInclude,
    });
  },
};
