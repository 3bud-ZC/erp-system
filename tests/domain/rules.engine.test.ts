import { describe, it, expect } from 'vitest';
import { rulesEngine } from '@/lib/domain/accounting/rules.engine';
import {
  AccountingErrorCode,
  type JournalEntryDraft,
} from '@/lib/domain/accounting/types';

const baseDraft = (
  lines: JournalEntryDraft['lines']
): JournalEntryDraft => ({
  entryDate: new Date('2026-01-01T00:00:00Z'),
  description: 'test',
  lines,
});

describe('rulesEngine.totals', () => {
  it('returns zeros for an empty array', () => {
    expect(rulesEngine.totals([])).toEqual({ totalDebit: 0, totalCredit: 0 });
  });

  it('aggregates debit and credit independently', () => {
    const t = rulesEngine.totals([
      { accountCode: '1000', debit: 100, credit: 0 },
      { accountCode: '2000', debit: 0, credit: 100 },
      { accountCode: '3000', debit: 50, credit: 0 },
      { accountCode: '4000', debit: 0, credit: 50 },
    ]);
    expect(t).toEqual({ totalDebit: 150, totalCredit: 150 });
  });

  it('rounds to 2 decimal places to neutralise float drift', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
    const t = rulesEngine.totals([
      { accountCode: '1000', debit: 0.1, credit: 0 },
      { accountCode: '1000', debit: 0.2, credit: 0 },
    ]);
    expect(t.totalDebit).toBe(0.3);
  });

  it('treats non-finite values as zero (defensive)', () => {
    const t = rulesEngine.totals([
      { accountCode: '1000', debit: Number.NaN, credit: 0 },
      { accountCode: '2000', debit: 0, credit: Number.POSITIVE_INFINITY },
      { accountCode: '3000', debit: 10, credit: 0 },
    ]);
    expect(t).toEqual({ totalDebit: 10, totalCredit: 0 });
  });
});

describe('rulesEngine.validate — empty / missing', () => {
  it('rejects an entry with zero lines', () => {
    const r = rulesEngine.validate(baseDraft([]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain(
        AccountingErrorCode.EMPTY_LINES
      );
    }
  });

  it('flags a missing account code with MISSING_ACCOUNT', () => {
    const r = rulesEngine.validate(
      baseDraft([
        { accountCode: '', debit: 100, credit: 0 },
        { accountCode: '2000', debit: 0, credit: 100 },
      ])
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === AccountingErrorCode.MISSING_ACCOUNT)).toBe(
        true
      );
    }
  });
});

describe('rulesEngine.validate — line shape', () => {
  it('rejects negative debit', () => {
    const r = rulesEngine.validate(
      baseDraft([
        { accountCode: '1000', debit: -10, credit: 0 },
        { accountCode: '2000', debit: 0, credit: 10 },
      ])
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].code).toBe(AccountingErrorCode.NEGATIVE_AMOUNT);
    }
  });

  it('rejects negative credit', () => {
    const r = rulesEngine.validate(
      baseDraft([
        { accountCode: '1000', debit: 10, credit: 0 },
        { accountCode: '2000', debit: 0, credit: -10 },
      ])
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].code).toBe(AccountingErrorCode.NEGATIVE_AMOUNT);
    }
  });

  it('rejects a line that is BOTH debit and credit', () => {
    const r = rulesEngine.validate(
      baseDraft([
        { accountCode: '1000', debit: 50, credit: 50 },
        { accountCode: '2000', debit: 0, credit: 0 },
      ])
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === AccountingErrorCode.INVALID_LINE)).toBe(
        true
      );
    }
  });

  it('rejects a line that is NEITHER debit nor credit (both zero)', () => {
    const r = rulesEngine.validate(
      baseDraft([
        { accountCode: '1000', debit: 0, credit: 0 },
        { accountCode: '2000', debit: 0, credit: 100 },
      ])
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === AccountingErrorCode.INVALID_LINE)).toBe(
        true
      );
    }
  });

  it('rejects non-numeric debit/credit', () => {
    const r = rulesEngine.validate(
      baseDraft([
        // @ts-expect-error — exercising defensive branch
        { accountCode: '1000', debit: 'oops', credit: 0 },
        { accountCode: '2000', debit: 0, credit: 100 },
      ])
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].code).toBe(AccountingErrorCode.INVALID_LINE);
    }
  });
});

describe('rulesEngine.validate — balance', () => {
  it('accepts a perfectly balanced 2-line entry', () => {
    const r = rulesEngine.validate(
      baseDraft([
        { accountCode: '1000', debit: 100, credit: 0 },
        { accountCode: '2000', debit: 0, credit: 100 },
      ])
    );
    expect(r.ok).toBe(true);
  });

  it('accepts a balanced multi-line entry (sales invoice shape)', () => {
    const r = rulesEngine.validate(
      baseDraft([
        { accountCode: '1100', debit: 1140, credit: 0 }, // AR
        { accountCode: '4010', debit: 0, credit: 1000 }, // Revenue
        { accountCode: '2030', debit: 0, credit: 140 }, // Sales tax payable
      ])
    );
    expect(r.ok).toBe(true);
  });

  it('accepts a balance within the 0.005 float-drift tolerance', () => {
    const r = rulesEngine.validate(
      baseDraft([
        { accountCode: '1000', debit: 100.001, credit: 0 },
        { accountCode: '2000', debit: 0, credit: 100 },
      ])
    );
    // After rounding totals: 100 vs 100 -> ok
    expect(r.ok).toBe(true);
  });

  it('rejects an unbalanced entry with UNBALANCED', () => {
    const r = rulesEngine.validate(
      baseDraft([
        { accountCode: '1000', debit: 100, credit: 0 },
        { accountCode: '2000', debit: 0, credit: 90 },
      ])
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain(AccountingErrorCode.UNBALANCED);
    }
  });

  it('does not check balance when individual lines are already invalid', () => {
    // Per the engine: only check balance when structural checks pass.
    const r = rulesEngine.validate(
      baseDraft([
        { accountCode: '', debit: 100, credit: 0 },
        { accountCode: '2000', debit: 0, credit: 90 },
      ])
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const codes = r.errors.map((e) => e.code);
      expect(codes).toContain(AccountingErrorCode.MISSING_ACCOUNT);
      expect(codes).not.toContain(AccountingErrorCode.UNBALANCED);
    }
  });
});
