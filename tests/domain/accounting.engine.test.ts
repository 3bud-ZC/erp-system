import { describe, it, expect } from 'vitest';
import { accountingEngine } from '@/lib/domain/accounting/accounting.engine';
import { AccountingErrorCode } from '@/lib/domain/accounting/types';

const validSalesInvoiceDraft = {
  entryDate: new Date('2026-01-01T00:00:00Z'),
  description: 'INV-1001',
  reference: { type: 'SalesInvoice', id: 'inv_1' },
  tenantId: 't_1',
  lines: [
    { accountCode: '1100', debit: 1140, credit: 0 }, // AR
    { accountCode: '4010', debit: 0, credit: 1000 }, // Revenue
    { accountCode: '2030', debit: 0, credit: 140 }, // Sales tax
  ],
};

describe('accountingEngine.processJournalEntry', () => {
  it('returns success=true for a valid balanced draft', async () => {
    const r = await accountingEngine.processJournalEntry(validSalesInvoiceDraft);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.entry.lines).toHaveLength(3);
      expect(r.result.posted).toBe(true);
      expect(r.result.entryId).toBe(r.entry.id);
      expect(r.result.postedAt).toBeInstanceOf(Date);
    }
  });

  it('returns success=false with errors for an unbalanced draft', async () => {
    const r = await accountingEngine.processJournalEntry({
      ...validSalesInvoiceDraft,
      lines: [
        { accountCode: '1100', debit: 1000, credit: 0 },
        { accountCode: '4010', debit: 0, credit: 999 },
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors.map((e) => e.code)).toContain(
        AccountingErrorCode.UNBALANCED
      );
    }
  });

  it('never throws — even on completely invalid input', async () => {
    const r = await accountingEngine.processJournalEntry({
      // @ts-expect-error — testing runtime defensiveness
      entryDate: 'not-a-date',
      lines: [],
    });
    expect(r.success).toBe(false);
  });

  it('preserves reference and tenantId on the produced entry', async () => {
    const r = await accountingEngine.processJournalEntry(validSalesInvoiceDraft);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.entry.reference).toEqual({ type: 'SalesInvoice', id: 'inv_1' });
      expect(r.entry.tenantId).toBe('t_1');
    }
  });

  it('exposes a validate() shortcut that does not run posting', () => {
    const r = accountingEngine.validate(validSalesInvoiceDraft);
    expect(r.ok).toBe(true);
  });

  it('validate() reports structured errors for an empty entry', () => {
    const r = accountingEngine.validate({
      entryDate: new Date(),
      lines: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].code).toBe(AccountingErrorCode.EMPTY_LINES);
    }
  });
});

describe('accountingEngine — real-world journal shapes', () => {
  it('accepts a purchase invoice shape (DR Inventory + DR Tax / CR Payable)', async () => {
    const r = await accountingEngine.processJournalEntry({
      entryDate: new Date('2026-01-01'),
      description: 'PUR-2001',
      reference: { type: 'PurchaseInvoice', id: 'pi_1' },
      lines: [
        { accountCode: '1300', debit: 1000, credit: 0 }, // Inventory
        { accountCode: '2030', debit: 140, credit: 0 }, // Input VAT
        { accountCode: '2010', debit: 0, credit: 1140 }, // AP
      ],
    });
    expect(r.success).toBe(true);
  });

  it('accepts an expense entry shape (DR Expense / CR Cash)', async () => {
    const r = await accountingEngine.processJournalEntry({
      entryDate: new Date('2026-01-01'),
      description: 'EXP-001',
      reference: { type: 'Expense', id: 'e_1' },
      lines: [
        { accountCode: '5100', debit: 250, credit: 0 }, // Expense
        { accountCode: '1010', debit: 0, credit: 250 }, // Cash
      ],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a multi-line manual journal with float-drift edge case', async () => {
    const r = await accountingEngine.processJournalEntry({
      entryDate: new Date('2026-01-01'),
      lines: [
        { accountCode: '1010', debit: 33.33, credit: 0 },
        { accountCode: '1010', debit: 33.33, credit: 0 },
        { accountCode: '1010', debit: 33.34, credit: 0 },
        { accountCode: '4010', debit: 0, credit: 100 },
      ],
    });
    expect(r.success).toBe(true);
  });
});
