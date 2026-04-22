/**
 * Accounting Adapter
 * Generates journal entries for all transactions
 */

import { ERPTransaction, ERPTransactionType } from '../types';
import { JournalService } from '../services/journal-service';

interface JournalEntryLine {
  debit: string;
  credit: string;
  amount: number;
  description?: string;
}

export class AccountingAdapter {
  static async post(tx: ERPTransaction, result: any): Promise<any[]> {
    const entries: JournalEntryLine[] = [];

    switch (tx.type) {
      case 'SALES_INVOICE':
        entries.push(
          {
            debit: 'Accounts Receivable',
            credit: 'Revenue',
            amount: result.total,
            description: `Sales Invoice ${result.id}`,
          },
          {
            debit: 'COGS',
            credit: 'Inventory',
            amount: result.cost || 0,
            description: `COGS for Invoice ${result.id}`,
          }
        );
        break;

      case 'SALES_RETURN':
        entries.push(
          {
            debit: 'Revenue',
            credit: 'Accounts Receivable',
            amount: result.total,
            description: `Sales Return ${result.id}`,
          },
          {
            debit: 'Inventory',
            credit: 'COGS',
            amount: result.cost || 0,
            description: `Return inventory ${result.id}`,
          }
        );
        break;

      case 'PURCHASE_INVOICE':
        entries.push(
          {
            debit: 'Inventory',
            credit: 'Accounts Payable',
            amount: result.total,
            description: `Purchase Invoice ${result.id}`,
          }
        );
        break;

      case 'PURCHASE_RETURN':
        entries.push(
          {
            debit: 'Accounts Payable',
            credit: 'Inventory',
            amount: result.total,
            description: `Purchase Return ${result.id}`,
          }
        );
        break;

      case 'PAYMENT':
        if (result.direction === 'IN') {
          // Customer payment
          entries.push(
            {
              debit: 'Cash',
              credit: 'Accounts Receivable',
              amount: result.amount,
              description: `Payment received ${result.id}`,
            }
          );
        } else {
          // Supplier payment
          entries.push(
            {
              debit: 'Accounts Payable',
              credit: 'Cash',
              amount: result.amount,
              description: `Payment made ${result.id}`,
            }
          );
        }
        break;

      case 'STOCK_ADJUSTMENT':
        if (result.adjustmentType === 'INCREASE') {
          entries.push(
            {
              debit: 'Inventory',
              credit: 'Inventory Adjustment',
              amount: result.value,
              description: `Stock increase ${result.id}`,
            }
          );
        } else {
          entries.push(
            {
              debit: 'Inventory Adjustment',
              credit: 'Inventory',
              amount: result.value,
              description: `Stock decrease ${result.id}`,
            }
          );
        }
        break;

      case 'PRODUCTION_ORDER':
        if (result.status === 'completed') {
          entries.push(
            {
              debit: 'Inventory - Finished Goods',
              credit: 'Work in Process',
              amount: result.totalCost,
              description: `Production completed ${result.id}`,
            }
          );
        }
        break;
    }

    // Validate entries balance
    const totalDebits = entries.reduce((sum, e) => sum + e.amount, 0);
    const totalCredits = entries.reduce((sum, e) => sum + e.amount, 0);
    
    if (totalDebits !== totalCredits) {
      throw new Error(
        `Journal entries do not balance. Debits: ${totalDebits}, Credits: ${totalCredits}`
      );
    }

    return JournalService.save(entries);
  }
}
