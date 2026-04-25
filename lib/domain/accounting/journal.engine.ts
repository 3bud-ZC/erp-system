/**
 * Accounting Domain — Journal Engine
 *
 * Responsible for materializing a validated, immutable JournalEntry from a
 * draft. Stateless. Does NOT touch persistence — that is the PostingEngine's
 * concern.
 */

import { randomUUID } from 'crypto';
import { rulesEngine } from './rules.engine';
import {
  AccountingError,
  JournalEntry,
  JournalEntryDraft,
  ValidationResult,
} from './types';

export const journalEngine = {
  /**
   * Build a validated JournalEntry from a draft.
   * Returns either the entry or a list of errors — never throws.
   */
  create(
    draft: JournalEntryDraft
  ): { ok: true; entry: JournalEntry } | { ok: false; errors: ReadonlyArray<AccountingError> } {
    const validation: ValidationResult = rulesEngine.validate(draft);
    if (!validation.ok) {
      return { ok: false, errors: validation.errors };
    }

    const entry: JournalEntry = {
      id: draft.id ?? randomUUID(),
      entryDate: draft.entryDate,
      description: draft.description,
      reference: draft.reference,
      tenantId: draft.tenantId,
      // Defensive copy + freeze so consumers cannot mutate the canonical entry.
      lines: Object.freeze(
        draft.lines.map((l) =>
          Object.freeze({
            accountCode: l.accountCode,
            debit: Math.round(l.debit * 100) / 100,
            credit: Math.round(l.credit * 100) / 100,
            description: l.description,
          })
        )
      ),
    };

    return { ok: true, entry };
  },
};
