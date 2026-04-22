/**
 * Journal Service
 * Handles journal entry creation and posting
 */

import { prisma } from '@/lib/db';

interface JournalEntryLine {
  debit: string;
  credit: string;
  amount: number;
  description?: string;
}

export class JournalService {
  static async save(entries: JournalEntryLine[]): Promise<any[]> {
    const savedEntries = [];
    
    // Create a journal entry header
    const journalEntry = await prisma.journalEntry.create({
      data: {
        entryNumber: `JE-${Date.now()}`,
        entryDate: new Date(),
        description: entries.map(e => e.description).join('; '),
        tenantId: 'default', // TODO: Get from context
      },
    });

    for (const entry of entries) {
      // Find or create accounts
      const debitAccount = await this.getAccount(entry.debit);
      const creditAccount = await this.getAccount(entry.credit);

      if (!debitAccount || !creditAccount) {
        throw new Error(`Account not found: ${!debitAccount ? entry.debit : entry.credit}`);
      }

      // Create journal entry lines
      const debitLine = await prisma.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountCode: debitAccount.code,
          debit: entry.amount,
          credit: 0,
          description: entry.description,
          tenantId: 'default',
        },
      });

      const creditLine = await prisma.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountCode: creditAccount.code,
          debit: 0,
          credit: entry.amount,
          description: entry.description,
          tenantId: 'default',
        },
      });

      savedEntries.push({
        debitAccount,
        creditAccount,
        amount: entry.amount,
        debitLine,
        creditLine,
      });
    }

    return savedEntries;
  }

  private static async getAccount(accountName: string): Promise<any> {
    // Map common account names to account codes
    const accountMap: { [key: string]: string } = {
      'Accounts Receivable': '1200',
      'Revenue': '4000',
      'COGS': '5000',
      'Inventory': '1300',
      'Accounts Payable': '2100',
      'Cash': '1000',
      'Inventory Adjustment': '1350',
      'Work in Process': '1400',
      'Inventory - Finished Goods': '1310',
    };

    const accountCode = accountMap[accountName];
    if (!accountCode) return null;

    return prisma.account.findUnique({
      where: { tenantId_code: { tenantId: 'default', code: accountCode } },
    });
  }
}
