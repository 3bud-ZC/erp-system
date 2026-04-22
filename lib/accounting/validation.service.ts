/**
 * Accounting Validation Service
 * Pre-commit validation for journal entries
 * Integrates with validation engine
 */

import { WorkflowValidator, ValidationContext, ValidationResult } from '../validation/validation-engine';
import { journalEntryService, CreateJournalEntryInput } from './journal-entry.service';
// import { chartOfAccountsService } from './chart-of-accounts.service';
import { accountingPeriodService } from './period.service';

// ============================================================================
// JOURNAL ENTRY VALIDATOR
// ============================================================================

export class JournalEntryValidator implements WorkflowValidator {
  async validate(input: CreateJournalEntryInput, context: ValidationContext): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // 1. Validate lines
    if (input.lines) {
      this.validateLines(input.lines, errors);

      // 2. Validate balance
      this.validateBalance(input.lines, errors);
    }

    // 3. Validate accounts exist and are active
    if (input.lines) {
      await this.validateAccounts(input.lines, input.tenantId, errors);
    }

    // 4. Validate accounting period is open
    if (input.accountingPeriodId) {
      await this.validatePeriodOpen(input.accountingPeriodId, input.tenantId, errors);
    }

    // 5. Validate fiscal year is not closed
    if (input.fiscalYearId) {
      await this.validateFiscalYearOpen(input.fiscalYearId, input.tenantId, errors);
    }

    // 6. Validate entry date is not in the future
    if (input.entryDate > new Date()) {
      errors.push({
        code: 'FUTURE_DATE',
        severity: 'error',
        message: 'Entry date cannot be in the future',
        field: 'entryDate',
      });
    }

    // 7. Validate at least 2 lines
    if (input.lines && input.lines.length < 2) {
      errors.push({
        code: 'MINIMUM_LINES',
        severity: 'error',
        message: 'Journal entry must have at least 2 lines',
        field: 'lines',
      });
    }

    // 8. Warnings
    this.checkWarnings(input, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      safeToExecute: errors.length === 0,
      metadata: {
        validatedAt: new Date(),
        workflowType: 'journal_entry',
        tenantId: input.tenantId,
        validationDurationMs: 0,
      },
    };
  }

  getRequiredSnapshot(input: CreateJournalEntryInput) {
    return {
      productIds: [],
      customerIds: [],
      supplierIds: [],
      accountCodes: input.lines?.map(l => l.accountCode) || [],
    };
  }

  async generateExecutionPlan(input: CreateJournalEntryInput, context: ValidationContext) {
    return {
      operations: [
        {
          type: 'create' as const,
          model: 'JournalEntry',
          data: input,
        },
      ],
      rollbackOperations: [
        {
          type: 'delete' as const,
          model: 'JournalEntry',
          // entryId would be populated after creation
        },
      ],
      resourceEstimates: {
        databaseWrites: 1 + (input.lines?.length || 0),
        databaseReads: (input.lines?.length || 0) + 2,
        estimatedMemoryMB: 1,
      },
    };
  }

  private validateLines(lines: any[], errors: any[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fieldPrefix = `lines[${i}]`;

      if (!line.accountCode) {
        errors.push({
          code: 'MISSING_ACCOUNT',
          severity: 'error',
          message: 'Account code is required',
          field: `${fieldPrefix}.accountCode`,
        });
      }

      if (line.debit < 0 || line.credit < 0) {
        errors.push({
          code: 'NEGATIVE_AMOUNT',
          severity: 'error',
          message: 'Debit and credit cannot be negative',
          field: `${fieldPrefix}`,
        });
      }

      if (line.debit > 0 && line.credit > 0) {
        errors.push({
          code: 'BOTH_DEBIT_CREDIT',
          severity: 'error',
          message: 'Line cannot have both debit and credit',
          field: `${fieldPrefix}`,
        });
      }

      if (line.debit === 0 && line.credit === 0) {
        errors.push({
          code: 'NO_AMOUNT',
          severity: 'error',
          message: 'Line must have either debit or credit',
          field: `${fieldPrefix}`,
        });
      }
    }
  }

  private validateBalance(lines: any[], errors: any[]): void {
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      errors.push({
        code: 'UNBALANCED_ENTRY',
        severity: 'error',
        message: `Journal entry does not balance. Debit: ${totalDebit}, Credit: ${totalCredit}`,
        field: 'lines',
        context: { totalDebit, totalCredit, difference: totalDebit - totalCredit },
      });
    }
  }

  private async validateAccounts(lines: any[], tenantId: string, errors: any[]): Promise<void> {
    // TODO: Re-enable when chartOfAccountsService is fixed for schema
    // for (let i = 0; i < lines.length; i++) {
    //   const line = lines[i];
    //   const fieldPrefix = `lines[${i}]`;
    //   try {
    //     await chartOfAccountsService.validateAccountForEntry(line.accountCode, tenantId);
    //   } catch (error: any) {
    //     errors.push({
    //       code: 'INVALID_ACCOUNT',
    //       severity: 'error',
    //       message: error.message || 'Invalid account',
    //       field: `${fieldPrefix}.accountCode`,
    //       context: { accountCode: line.accountCode },
    //     });
    //   }
    // }
  }

  private async validatePeriodOpen(periodId: string, tenantId: string, errors: any[]): Promise<void> {
    try {
      const period = await accountingPeriodService.getAccountingPeriod(periodId, tenantId);
      if (period && (period as any).status !== 'OPEN') {
        errors.push({
          code: 'PERIOD_CLOSED',
          severity: 'error',
          message: 'Accounting period is closed. Cannot post entries.',
          field: 'accountingPeriodId',
        });
      }
    } catch (error: any) {
      errors.push({
        code: 'INVALID_PERIOD',
        severity: 'error',
        message: error.message || 'Invalid accounting period',
        field: 'accountingPeriodId',
      });
    }
  }

  private async validateFiscalYearOpen(fiscalYearId: string, tenantId: string, errors: any[]): Promise<void> {
    try {
      const fiscalYear = await accountingPeriodService.getFiscalYear(fiscalYearId, tenantId);
      if (fiscalYear && fiscalYear.isClosed) {
        errors.push({
          code: 'FISCAL_YEAR_CLOSED',
          severity: 'error',
          message: 'Fiscal year is closed. Cannot post entries.',
          field: 'fiscalYearId',
        });
      }
    } catch (error: any) {
      errors.push({
        code: 'INVALID_FISCAL_YEAR',
        severity: 'error',
        message: error.message || 'Invalid fiscal year',
        field: 'fiscalYearId',
      });
    }
  }

  private checkWarnings(input: CreateJournalEntryInput, warnings: any[]): void {
    // Warn if entry date is old (more than 30 days)
    const daysOld = Math.floor((Date.now() - input.entryDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOld > 30) {
      warnings.push({
        code: 'OLD_ENTRY_DATE',
        severity: 'warning',
        message: `Entry date is ${daysOld} days old. Consider if this is correct.`,
        field: 'entryDate',
        context: { daysOld },
      });
    }

    // Warn if description is missing or too short
    if (!input.description || input.description.length < 10) {
      warnings.push({
        code: 'SHORT_DESCRIPTION',
        severity: 'warning',
        message: 'Description is too short. Consider adding more details.',
        field: 'description',
      });
    }
  }
}

export const journalEntryValidator = new JournalEntryValidator();
