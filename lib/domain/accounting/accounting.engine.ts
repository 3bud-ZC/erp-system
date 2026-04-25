/**
 * Accounting Domain — Facade (Public Entry Point)
 *
 * The ONLY symbol external modules should import from this domain.
 * Orchestrates: validation -> journal materialization -> ledger posting.
 *
 * Usage:
 *   import { accountingEngine } from '@/lib/domain/accounting/accounting.engine';
 *   const result = await accountingEngine.processJournalEntry(draft);
 *   if (!result.success) { ... }
 */

import { journalEngine } from './journal.engine';
import { postingEngine } from './posting.engine';
import { rulesEngine } from './rules.engine';
import {
  AccountingResult,
  JournalEntryDraft,
  ValidationResult,
} from './types';

export const accountingEngine = {
  /**
   * Validate, materialize, and post a journal entry in a single call.
   * Returns a discriminated-union AccountingResult — never throws.
   */
  async processJournalEntry(draft: JournalEntryDraft): Promise<AccountingResult> {
    const built = journalEngine.create(draft);
    if (!built.ok) {
      return { success: false, errors: built.errors };
    }

    const posted = await postingEngine.post(built.entry);
    if (!posted.ok) {
      return { success: false, errors: posted.errors };
    }

    return {
      success: true,
      entry: built.entry,
      result: posted.result,
    };
  },

  /** Expose validation only — useful for client-side or pre-submit checks. */
  validate(draft: JournalEntryDraft): ValidationResult {
    return rulesEngine.validate(draft);
  },
};

// Re-export types so consumers need only import the facade module.
export * from './types';
