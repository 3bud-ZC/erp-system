/**
 * Accounting Domain — Rules Engine
 *
 * Pure, side-effect-free validators that enforce accounting invariants.
 * Never throws; always returns a structured ValidationResult.
 */

import {
  AccountingError,
  AccountingErrorCode,
  JournalEntryDraft,
  JournalEntryLine,
  ValidationResult,
} from './types';

/** Smallest accounting unit tolerance — handles binary float drift. */
const BALANCE_TOLERANCE = 0.005;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function validateLine(line: JournalEntryLine, index: number): AccountingError | null {
  if (!line.accountCode || typeof line.accountCode !== 'string') {
    return {
      code: AccountingErrorCode.MISSING_ACCOUNT,
      message: `Line ${index + 1} is missing an account code.`,
      details: { index },
    };
  }
  if (!isFiniteNumber(line.debit) || !isFiniteNumber(line.credit)) {
    return {
      code: AccountingErrorCode.INVALID_LINE,
      message: `Line ${index + 1} has non-numeric debit or credit.`,
      details: { index, debit: line.debit, credit: line.credit },
    };
  }
  if (line.debit < 0 || line.credit < 0) {
    return {
      code: AccountingErrorCode.NEGATIVE_AMOUNT,
      message: `Line ${index + 1} has a negative amount.`,
      details: { index, debit: line.debit, credit: line.credit },
    };
  }
  // Each line must be a debit XOR a credit; not both, not neither.
  const hasDebit = line.debit > 0;
  const hasCredit = line.credit > 0;
  if (hasDebit === hasCredit) {
    return {
      code: AccountingErrorCode.INVALID_LINE,
      message: `Line ${index + 1} must be either a debit or a credit (exclusive).`,
      details: { index, debit: line.debit, credit: line.credit },
    };
  }
  return null;
}

export const rulesEngine = {
  /** Validate a draft journal entry. Returns structured errors instead of throwing. */
  validate(draft: JournalEntryDraft): ValidationResult {
    const errors: AccountingError[] = [];

    if (!draft.lines || draft.lines.length === 0) {
      errors.push({
        code: AccountingErrorCode.EMPTY_LINES,
        message: 'Journal entry must have at least one line.',
      });
      return { ok: false, errors };
    }

    for (let i = 0; i < draft.lines.length; i++) {
      const lineError = validateLine(draft.lines[i], i);
      if (lineError) errors.push(lineError);
    }

    // Only check balance if every line passed structural checks.
    if (errors.length === 0) {
      const totals = rulesEngine.totals(draft.lines);
      if (Math.abs(totals.totalDebit - totals.totalCredit) > BALANCE_TOLERANCE) {
        errors.push({
          code: AccountingErrorCode.UNBALANCED,
          message: 'Journal entry is unbalanced: total debit must equal total credit.',
          details: {
            totalDebit: totals.totalDebit,
            totalCredit: totals.totalCredit,
            difference: totals.totalDebit - totals.totalCredit,
          },
        });
      }
    }

    return errors.length === 0 ? { ok: true } : { ok: false, errors };
  },

  /** Compute aggregate debit/credit totals for a set of lines. Pure. */
  totals(lines: ReadonlyArray<JournalEntryLine>): {
    totalDebit: number;
    totalCredit: number;
  } {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += isFiniteNumber(line.debit) ? line.debit : 0;
      totalCredit += isFiniteNumber(line.credit) ? line.credit : 0;
    }
    // Round to 2 decimal places to neutralize float drift on display.
    return {
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
    };
  },
};
