/**
 * Accounting Domain — Phase 1 Dual-Run Adapter
 *
 * Runs the new accountingEngine in PARALLEL with the legacy posting path
 * (lib/accounting.ts) for safety validation.
 *
 * - Never throws.
 * - Never mutates the legacy entry or its persistence.
 * - Only emits console.warn on mismatch.
 *
 * To be removed in Phase 4 once the new engine is the source of truth.
 */

import { prisma } from '@/lib/db';
import { accountingEngine } from './accounting.engine';
import { JournalEntryDraft, JournalEntryLine } from './types';

/** Minimal shape of the legacy Prisma JournalEntry we need for comparison. */
interface LegacyEntryLike {
  readonly id?: string | null;
  readonly entryDate?: Date | string | null;
  readonly description?: string | null;
  readonly referenceType?: string | null;
  readonly referenceId?: string | null;
  readonly tenantId?: string | null;
  readonly lines: ReadonlyArray<{
    readonly accountCode: string;
    // Prisma Decimal | number — coerced via Number().
    readonly debit: unknown;
    readonly credit: unknown;
    readonly description?: string | null;
  }>;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildDraft(legacy: LegacyEntryLike): JournalEntryDraft {
  const lines: JournalEntryLine[] = legacy.lines.map((l) => ({
    accountCode: l.accountCode,
    debit: toNumber(l.debit),
    credit: toNumber(l.credit),
    description: l.description ?? undefined,
  }));
  return {
    id: legacy.id ?? undefined,
    entryDate: legacy.entryDate
      ? legacy.entryDate instanceof Date
        ? legacy.entryDate
        : new Date(legacy.entryDate)
      : new Date(),
    description: legacy.description ?? undefined,
    reference:
      legacy.referenceType && legacy.referenceId
        ? { type: legacy.referenceType, id: legacy.referenceId }
        : undefined,
    tenantId: legacy.tenantId ?? undefined,
    lines,
  };
}

/**
 * Execute the new engine alongside the legacy path and silently warn on
 * any divergence. Awaiting this function never throws.
 *
 * @param source     Tag identifying the call site (e.g. "SalesInvoice:POST").
 * @param legacy     The legacy Prisma JournalEntry (must include `.lines`).
 */
export async function dualRunCompare(
  source: string,
  legacy: LegacyEntryLike | null | undefined
): Promise<void> {
  if (!legacy || !legacy.lines || legacy.lines.length === 0) return;

  try {
    const draft = buildDraft(legacy);

    // Legacy totals (rounded to 2dp for comparison).
    const legacyTotalDebit =
      Math.round(draft.lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
    const legacyTotalCredit =
      Math.round(draft.lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
    const legacyLineCount = draft.lines.length;

    const result = await accountingEngine.processJournalEntry(draft);

    if (!result.success) {
      console.warn(
        `[accounting:dual-run] [${source}] new engine REJECTED a legacy-accepted entry`,
        {
          legacyId: legacy.id,
          legacyTotalDebit,
          legacyTotalCredit,
          legacyLineCount,
          errors: result.errors.map((e) => ({ code: e.code, message: e.message })),
        }
      );
      return;
    }

    const newTotalDebit =
      Math.round(result.entry.lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
    const newTotalCredit =
      Math.round(result.entry.lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
    const newLineCount = result.entry.lines.length;

    const debitMismatch = Math.abs(newTotalDebit - legacyTotalDebit) > 0.005;
    const creditMismatch = Math.abs(newTotalCredit - legacyTotalCredit) > 0.005;
    const countMismatch = newLineCount !== legacyLineCount;

    if (debitMismatch || creditMismatch || countMismatch) {
      console.warn(
        `[accounting:dual-run] [${source}] totals/line-count mismatch`,
        {
          legacyId: legacy.id,
          legacyTotalDebit,
          legacyTotalCredit,
          legacyLineCount,
          newTotalDebit,
          newTotalCredit,
          newLineCount,
        }
      );
    }
  } catch (err) {
    // Dual-run must NEVER affect the live request.
    console.warn(
      `[accounting:dual-run] [${source}] adapter threw (suppressed)`,
      { error: err instanceof Error ? err.message : String(err) }
    );
  }
}

/**
 * Variant that fetches the entry (with lines) by id before comparing.
 * Use when the legacy producer (e.g. atomic transaction service) does not
 * return its lines in the result object.
 */
export async function dualRunCompareById(
  source: string,
  entryId: string | null | undefined
): Promise<void> {
  if (!entryId) return;
  try {
    const fetched = await prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: { lines: true },
    });
    await dualRunCompare(source, fetched as unknown as LegacyEntryLike);
  } catch (err) {
    console.warn(
      `[accounting:dual-run] [${source}] fetch-by-id failed (suppressed)`,
      { error: err instanceof Error ? err.message : String(err), entryId }
    );
  }
}
