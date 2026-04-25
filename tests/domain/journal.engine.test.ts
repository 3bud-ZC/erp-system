import { describe, it, expect } from 'vitest';
import { journalEngine } from '@/lib/domain/accounting/journal.engine';
import { AccountingErrorCode } from '@/lib/domain/accounting/types';

describe('journalEngine.create', () => {
  const validDraft = {
    entryDate: new Date('2026-01-01T00:00:00Z'),
    description: 'Sale to ACME',
    lines: [
      { accountCode: '1100', debit: 100, credit: 0 },
      { accountCode: '4010', debit: 0, credit: 100 },
    ],
  };

  it('returns ok=true for a valid balanced draft', () => {
    const r = journalEngine.create(validDraft);
    expect(r.ok).toBe(true);
  });

  it('preserves the supplied id when present', () => {
    const r = journalEngine.create({ ...validDraft, id: 'fixed-id-123' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entry.id).toBe('fixed-id-123');
  });

  it('generates a UUID id when none supplied', () => {
    const r = journalEngine.create(validDraft);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }
  });

  it('rounds line amounts to 2 decimal places', () => {
    const r = journalEngine.create({
      ...validDraft,
      lines: [
        { accountCode: '1100', debit: 100.005, credit: 0 },
        { accountCode: '4010', debit: 0, credit: 100.005 },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Math.round(100.005 * 100) / 100 = 100.01 (banker's rounding doesn't apply in JS)
      // exact value is implementation-defined for .5 ties, just assert it's 2dp
      const debit = r.entry.lines[0].debit;
      const credit = r.entry.lines[1].credit;
      expect(Number.isInteger(debit * 100)).toBe(true);
      expect(Number.isInteger(credit * 100)).toBe(true);
    }
  });

  it('returns frozen lines that cannot be mutated by consumers', () => {
    const r = journalEngine.create(validDraft);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.isFrozen(r.entry.lines)).toBe(true);
      expect(Object.isFrozen(r.entry.lines[0])).toBe(true);
      expect(() => {
        // @ts-expect-error — mutating a readonly frozen field
        r.entry.lines[0].debit = 9999;
      }).toThrow();
    }
  });

  it('returns errors instead of throwing for an unbalanced draft', () => {
    const r = journalEngine.create({
      ...validDraft,
      lines: [
        { accountCode: '1100', debit: 100, credit: 0 },
        { accountCode: '4010', debit: 0, credit: 50 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain(
        AccountingErrorCode.UNBALANCED
      );
    }
  });

  it('returns errors instead of throwing for empty lines', () => {
    const r = journalEngine.create({ ...validDraft, lines: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => e.code)).toContain(
        AccountingErrorCode.EMPTY_LINES
      );
    }
  });

  it('strips defensive copy — mutating original draft does not affect entry', () => {
    const lines = [
      { accountCode: '1100', debit: 100, credit: 0 },
      { accountCode: '4010', debit: 0, credit: 100 },
    ];
    const r = journalEngine.create({ ...validDraft, lines });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // mutate the original input array — entry must be unaffected
      lines[0] = { accountCode: 'X', debit: 1, credit: 0 };
      expect(r.entry.lines[0].accountCode).toBe('1100');
    }
  });
});
