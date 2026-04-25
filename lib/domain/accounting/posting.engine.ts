/**
 * Accounting Domain — Posting Engine
 *
 * Responsible for committing a validated JournalEntry to the ledger.
 *
 * IMPORTANT: This is intentionally a pure simulation today. The existing
 * production posting path (lib/accounting.ts) remains the source of truth
 * and is NOT touched by this domain layer. When the system is ready to
 * cut over, the body of `post` can be replaced with a Prisma-backed
 * implementation without changing any caller.
 */

import {
  AccountingError,
  AccountingErrorCode,
  JournalEntry,
  PostingResult,
} from './types';

export const postingEngine = {
  /**
   * Simulate posting a validated journal entry.
   * Returns a PostingResult on success or a structured error on failure.
   */
  async post(
    entry: JournalEntry
  ): Promise<{ ok: true; result: PostingResult } | { ok: false; errors: ReadonlyArray<AccountingError> }> {
    if (!entry.id) {
      return {
        ok: false,
        errors: [
          {
            code: AccountingErrorCode.POSTING_FAILED,
            message: 'Cannot post an entry without an id.',
          },
        ],
      };
    }

    // Future: replace with prisma.$transaction([...lineUpserts, postFlag]).
    const result: PostingResult = {
      posted: true,
      entryId: entry.id,
      postedAt: new Date(),
    };

    return { ok: true, result };
  },
};
