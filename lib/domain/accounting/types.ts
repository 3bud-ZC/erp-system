/**
 * Accounting Domain — Shared Types
 *
 * These types are the contract for the entire accounting domain layer.
 * They are intentionally decoupled from Prisma so the domain can evolve
 * independently of the storage schema.
 */

/** A single line of a journal entry. Exactly one of debit/credit must be > 0. */
export interface JournalEntryLine {
  /** Chart-of-accounts code (e.g. "1010", "4010"). */
  readonly accountCode: string;
  /** Debit amount in the smallest accounting currency unit (e.g. EGP). Default 0. */
  readonly debit: number;
  /** Credit amount. Default 0. */
  readonly credit: number;
  /** Optional human-readable description for the line. */
  readonly description?: string;
}

/** Reference to the source business document that triggered the entry. */
export interface JournalReference {
  /** e.g. "SalesInvoice", "PurchaseInvoice", "Expense", "Manual". */
  readonly type: string;
  /** Foreign id of the source document. */
  readonly id: string;
}

/** A validated, multi-line journal entry. */
export interface JournalEntry {
  /** Stable unique id. Assigned by the JournalEngine if absent. */
  readonly id: string;
  /** Effective entry date. */
  readonly entryDate: Date;
  /** Optional narration. */
  readonly description?: string;
  /** Optional reference to the originating business document. */
  readonly reference?: JournalReference;
  /** Tenant id for multi-tenant scoping. Optional at the domain level. */
  readonly tenantId?: string;
  /** At least one line. Lines must balance (sum debit == sum credit). */
  readonly lines: ReadonlyArray<JournalEntryLine>;
}

/** Input shape accepted by the engine. `id` is optional (will be generated). */
export type JournalEntryDraft = Omit<JournalEntry, 'id' | 'lines'> & {
  readonly id?: string;
  readonly lines: ReadonlyArray<JournalEntryLine>;
};

/** Structured error returned by the rules engine — never thrown. */
export interface AccountingError {
  readonly code: AccountingErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Stable error codes — safe to switch on at the call site. */
export enum AccountingErrorCode {
  EMPTY_LINES = 'EMPTY_LINES',
  UNBALANCED = 'UNBALANCED',
  INVALID_LINE = 'INVALID_LINE',
  NEGATIVE_AMOUNT = 'NEGATIVE_AMOUNT',
  MISSING_ACCOUNT = 'MISSING_ACCOUNT',
  POSTING_FAILED = 'POSTING_FAILED',
}

/** Outcome of validating an entry. */
export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: ReadonlyArray<AccountingError> };

/** Outcome of attempting to post an entry to the ledger. */
export interface PostingResult {
  readonly posted: boolean;
  readonly entryId: string;
  readonly postedAt: Date;
}

/** Discriminated-union result returned by the AccountingEngine facade. */
export type AccountingResult =
  | {
      readonly success: true;
      readonly entry: JournalEntry;
      readonly result: PostingResult;
    }
  | {
      readonly success: false;
      readonly errors: ReadonlyArray<AccountingError>;
    };
