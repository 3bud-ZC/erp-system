/**
 * ENTERPRISE-GRADE MIGRATION SCRIPT: CashTransaction to JournalEntry
 * 
 * Production-safe financial migration tool with:
 * - Dry-run mode for simulation
 * - Batch processing (200 records/batch)
 * - Account validation with auto-creation
 * - Checkpoint system for resume capability
 * - Isolated error handling
 * - Audit-grade reporting
 * - Client demo mode
 * 
 * CRITICAL: This is a financial system migration. Ensure:
 * - Database backup before running
 * - Test in staging environment first
 * - Review dry-run report before execution
 * - Validate results before committing
 */

import { prisma } from '../lib/db';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BATCH_SIZE = 200;
const CHECKPOINT_FILE = join(process.cwd(), '.migration-checkpoint.json');
const DEFAULT_ACCOUNTS = {
  '1001': { code: '1001', nameAr: 'النقد', nameEn: 'Cash', type: 'Asset', subType: 'Cash' },
  '1010': { code: '1010', nameAr: 'البنك', nameEn: 'Bank', type: 'Asset', subType: 'Bank' },
  '4001': { code: '4001', nameAr: 'المبيعات', nameEn: 'Sales Revenue', type: 'Revenue', subType: 'Sales' },
  '5001': { code: '5001', nameAr: 'المشتريات', nameEn: 'Purchases', type: 'Expense', subType: 'COGS' },
  '6001': { code: '6001', nameAr: 'المصاريف التشغيلية', nameEn: 'Operating Expenses', type: 'Expense', subType: 'Operating' },
};

export interface MigrationConfig {
  dryRun: boolean;
  demoMode: boolean;
  batchSize: number;
  autoCreateAccounts: boolean;
}

export interface BatchResult {
  batchNumber: number;
  totalRecords: number;
  processed: number;
  migrated: number;
  skipped: {
    alreadyMigrated: number;
    missingAccount: number;
    validationError: number;
  };
  failed: Array<{ id: string; reason: string }>;
  startTime: Date;
  endTime: Date;
  duration: number;
}

export interface MigrationResult {
  success: boolean;
  config: MigrationConfig;
  totalRecords: number;
  totalMigrated: number;
  totalSkipped: {
    alreadyMigrated: number;
    missingAccount: number;
    validationError: number;
  };
  totalFailed: number;
  failedRecords: Array<{ id: string; reason: string }>;
  batches: BatchResult[];
  errors: string[];
  inconsistencies: string[];
  financialIntegrityScore: number;
  reconciliation: {
    oldCashBalance: number;
    newCashBalance: number;
    balanceMatch: boolean;
    difference: number;
  };
  performance: {
    totalTime: number;
    avgTimePerBatch: number;
    avgTimePerRecord: number;
  };
}

interface CashTransactionRecord {
  id: string;
  type: string;
  amount: number;
  source: string;
  referenceId: string | null;
  date: Date;
  notes: string | null;
}

interface CheckpointData {
  lastProcessedIndex: number;
  lastProcessedId: string;
  timestamp: Date;
  config: MigrationConfig;
}

// ============================================================================
// CHECKPOINT SYSTEM
// ============================================================================

function loadCheckpoint(): CheckpointData | null {
  try {
    if (existsSync(CHECKPOINT_FILE)) {
      const data = readFileSync(CHECKPOINT_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Failed to load checkpoint:', error);
  }
  return null;
}

function saveCheckpoint(checkpoint: CheckpointData): void {
  try {
    writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  } catch (error) {
    console.error('Failed to save checkpoint:', error);
  }
}

function clearCheckpoint(): void {
  try {
    if (existsSync(CHECKPOINT_FILE)) {
      const fs = require('fs');
      fs.unlinkSync(CHECKPOINT_FILE);
    }
  } catch (error) {
    console.warn('Failed to clear checkpoint:', error);
  }
}

// ============================================================================
// ACCOUNT VALIDATION SYSTEM
// ============================================================================

async function validateOrCreateAccount(accountCode: string, autoCreate: boolean, tenantId: string = 'default'): Promise<{ valid: boolean; created: boolean; error?: string }> {
  try {
    const account = await prisma.account.findUnique({
      where: { tenantId_code: { tenantId, code: accountCode } },
    });

    if (account) {
      return { valid: true, created: false };
    }

    if (!autoCreate) {
      return { valid: false, created: false, error: `Account ${accountCode} not found and auto-create is disabled` };
    }

    const defaultAccount = DEFAULT_ACCOUNTS[accountCode as keyof typeof DEFAULT_ACCOUNTS];
    if (defaultAccount) {
      await prisma.account.create({
        data: { ...defaultAccount, tenantId },
      });
      console.log(`  [AUTO-CREATE] Created account: ${accountCode} - ${defaultAccount.nameEn}`);
      return { valid: true, created: true };
    }

    return { valid: false, created: false, error: `Account ${accountCode} not found and no default available` };
  } catch (error) {
    return { valid: false, created: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ============================================================================
// SOURCE ACCOUNT MAPPING
// ============================================================================

function getSourceAccount(source: string): string {
  const sourceMap: Record<string, string> = {
    'sales': '4001',
    'purchase': '5001',
    'expense': '6001',
    'payment': '1001',
    'other': '1001',
  };
  return sourceMap[source] || '1001';
}

// ============================================================================
// SINGLE RECORD MIGRATION
// ============================================================================

async function migrateCashTransaction(
  tx: any,
  record: CashTransactionRecord,
  config: MigrationConfig,
  dryRun: boolean
): Promise<{ success: boolean; skipped?: boolean; skipReason?: string; error?: string }> {
  try {
    const existingEntry = await tx.journalEntry.findFirst({
      where: {
        referenceType: 'LegacyCashTransaction',
        referenceId: record.id,
      },
    });

    if (existingEntry) {
      return { success: true, skipped: true, skipReason: 'already_migrated' };
    }

    const cashAccountCode = '1001';
    const sourceAccountCode = getSourceAccount(record.source);

    const cashAccountValid = await validateOrCreateAccount(cashAccountCode, config.autoCreateAccounts);
    const sourceAccountValid = await validateOrCreateAccount(sourceAccountCode, config.autoCreateAccounts);

    if (!cashAccountValid.valid) {
      return { success: true, skipped: true, skipReason: 'missing_account', error: cashAccountValid.error };
    }

    if (!sourceAccountValid.valid) {
      return { success: true, skipped: true, skipReason: 'missing_account', error: sourceAccountValid.error };
    }

    if (dryRun || config.demoMode) {
      return { success: true };
    }

    const entryNumber = `MIG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

    const journalEntry = await tx.journalEntry.create({
      data: {
        entryNumber,
        entryDate: record.date,
        description: `Legacy Cash Transaction: ${record.source} - ${record.notes || 'No notes'}`,
        referenceType: 'LegacyCashTransaction',
        referenceId: record.id,
        totalDebit: 0,
        totalCredit: 0,
        isPosted: false,
      },
    });

    let lines: any[] = [];

    if (record.type === 'IN') {
      lines = [
        {
          journalEntryId: journalEntry.id,
          accountCode: cashAccountCode,
          debit: record.amount,
          credit: 0,
          description: `Cash IN from ${record.source}`,
        },
        {
          journalEntryId: journalEntry.id,
          accountCode: sourceAccountCode,
          debit: 0,
          credit: record.amount,
          description: `Cash IN from ${record.source}`,
        },
      ];
    } else {
      lines = [
        {
          journalEntryId: journalEntry.id,
          accountCode: cashAccountCode,
          debit: 0,
          credit: record.amount,
          description: `Cash OUT for ${record.source}`,
        },
        {
          journalEntryId: journalEntry.id,
          accountCode: sourceAccountCode,
          debit: record.amount,
          credit: 0,
          description: `Cash OUT for ${record.source}`,
        },
      ];
    }

    await tx.journalEntryLine.createMany({
      data: lines,
    });

    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    await tx.journalEntry.update({
      where: { id: journalEntry.id },
      data: {
        totalDebit,
        totalCredit,
      },
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { success: true, skipped: true, skipReason: 'validation_error', error: `Balance equation violated: Debit ${totalDebit} != Credit ${totalCredit}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

async function processBatch(
  records: CashTransactionRecord[],
  batchNumber: number,
  config: MigrationConfig
): Promise<BatchResult> {
  const result: BatchResult = {
    batchNumber,
    totalRecords: records.length,
    processed: 0,
    migrated: 0,
    skipped: {
      alreadyMigrated: 0,
      missingAccount: 0,
      validationError: 0,
    },
    failed: [],
    startTime: new Date(),
    endTime: new Date(),
    duration: 0,
  };

  const dryRun = config.dryRun || config.demoMode;

  try {
    await prisma.$transaction(async (tx) => {
      for (const record of records) {
        const migrationResult = await migrateCashTransaction(tx, record, config, dryRun);

        result.processed++;

        if (migrationResult.success) {
          if (migrationResult.skipped) {
            if (migrationResult.skipReason === 'already_migrated') {
              result.skipped.alreadyMigrated++;
            } else if (migrationResult.skipReason === 'missing_account') {
              result.skipped.missingAccount++;
            } else if (migrationResult.skipReason === 'validation_error') {
              result.skipped.validationError++;
            }
          } else {
            result.migrated++;
          }
        } else {
          result.failed.push({
            id: record.id,
            reason: migrationResult.error || 'Unknown error',
          });
        }
      }
    });

    result.endTime = new Date();
    result.duration = result.endTime.getTime() - result.startTime.getTime();

    return result;
  } catch (error) {
    result.endTime = new Date();
    result.duration = result.endTime.getTime() - result.startTime.getTime();
    throw error;
  }
}

// ============================================================================
// MAIN MIGRATION FUNCTION
// ============================================================================

export async function migrateCashTransactions(config: MigrationConfig): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    config,
    totalRecords: 0,
    totalMigrated: 0,
    totalSkipped: {
      alreadyMigrated: 0,
      missingAccount: 0,
      validationError: 0,
    },
    totalFailed: 0,
    failedRecords: [],
    batches: [],
    errors: [],
    inconsistencies: [],
    financialIntegrityScore: 0,
    reconciliation: {
      oldCashBalance: 0,
      newCashBalance: 0,
      balanceMatch: false,
      difference: 0,
    },
    performance: {
      totalTime: 0,
      avgTimePerBatch: 0,
      avgTimePerRecord: 0,
    },
  };

  const startTime = Date.now();
  const dryRun = config.dryRun || config.demoMode;

  try {
    console.log('='.repeat(80));
    console.log('ENTERPRISE-GRADE CASH TRANSACTION MIGRATION');
    console.log('='.repeat(80));
    console.log(`Mode: ${dryRun ? 'DRY-RUN (Simulation)' : 'PRODUCTION (Live)'}`);
    console.log(`Demo Mode: ${config.demoMode ? 'YES' : 'NO'}`);
    console.log(`Batch Size: ${config.batchSize}`);
    console.log(`Auto-Create Accounts: ${config.autoCreateAccounts ? 'YES' : 'NO'}`);
    console.log('='.repeat(80));

    let tableExists = false;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "CashTransaction" LIMIT 1`;
      tableExists = true;
    } catch (error) {
      console.log('CashTransaction table does not exist - migration complete');
      result.success = true;
      result.financialIntegrityScore = 100;
      return result;
    }

    if (!tableExists) {
      console.log('CashTransaction table does not exist - migration complete');
      result.success = true;
      result.financialIntegrityScore = 100;
      return result;
    }

    const cashTransactions = await prisma.$queryRaw<CashTransactionRecord[]>`
      SELECT * FROM "CashTransaction" ORDER BY "date" ASC
    `;

    result.totalRecords = cashTransactions.length;
    console.log(`Found ${cashTransactions.length} CashTransaction records`);

    if (cashTransactions.length === 0) {
      console.log('No records to migrate');
      result.success = true;
      result.financialIntegrityScore = 100;
      return result;
    }

    const checkpoint = loadCheckpoint();
    let startIndex = 0;

    if (checkpoint && !config.demoMode && !config.dryRun) {
      startIndex = checkpoint.lastProcessedIndex + 1;
      console.log(`Resuming from checkpoint: record ${startIndex}`);
    }

    const totalIn = cashTransactions
      .filter(r => r.type === 'IN')
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const totalOut = cashTransactions
      .filter(r => r.type === 'OUT')
      .reduce((sum, r) => sum + Number(r.amount), 0);
    result.reconciliation.oldCashBalance = totalIn - totalOut;

    const totalBatches = Math.ceil(cashTransactions.length / config.batchSize);
    console.log(`Processing ${totalBatches} batches...`);

    for (let i = 0; i < totalBatches; i++) {
      const batchStart = startIndex + (i * config.batchSize);
      const batchEnd = Math.min(batchStart + config.batchSize, cashTransactions.length);

      if (batchStart >= cashTransactions.length) {
        console.log(`Batch ${i + 1}/${totalBatches}: No more records to process`);
        break;
      }

      const batchRecords = cashTransactions.slice(batchStart, batchEnd);

      console.log(`\nBatch ${i + 1}/${totalBatches}: Processing ${batchRecords.length} records (index ${batchStart}-${batchEnd - 1})`);

      try {
        const batchResult = await processBatch(batchRecords, i + 1, config);
        result.batches.push(batchResult);

        result.totalMigrated += batchResult.migrated;
        result.totalSkipped.alreadyMigrated += batchResult.skipped.alreadyMigrated;
        result.totalSkipped.missingAccount += batchResult.skipped.missingAccount;
        result.totalSkipped.validationError += batchResult.skipped.validationError;
        result.totalFailed += batchResult.failed.length;
        result.failedRecords.push(...batchResult.failed);

        console.log(`  ✓ Processed: ${batchResult.processed}`);
        console.log(`  ✓ Migrated: ${batchResult.migrated}`);
        console.log(`  ✓ Skipped: ${batchResult.skipped.alreadyMigrated + batchResult.skipped.missingAccount + batchResult.skipped.validationError}`);
        console.log(`  ✓ Failed: ${batchResult.failed.length}`);
        console.log(`  ✓ Duration: ${batchResult.duration}ms`);

        if (!dryRun && batchResult.failed.length === 0) {
          saveCheckpoint({
            lastProcessedIndex: batchEnd - 1,
            lastProcessedId: batchRecords[batchRecords.length - 1].id,
            timestamp: new Date(),
            config,
          });
        }

        if (batchResult.failed.length > batchRecords.length * 0.1) {
          console.log(`  ⚠  Too many failures (${batchResult.failed.length}/${batchRecords.length}) - stopping migration`);
          break;
        }
      } catch (error) {
        console.error(`  ✗ Batch ${i + 1} failed:`, error);
        result.errors.push(`Batch ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const endTime = Date.now();
    result.performance.totalTime = endTime - startTime;
    result.performance.avgTimePerBatch = result.performance.totalTime / result.batches.length;
    result.performance.avgTimePerRecord = result.performance.totalTime / result.totalRecords;

    if (!dryRun) {
      const migratedEntries = await prisma.journalEntry.findMany({
        where: {
          referenceType: 'LegacyCashTransaction',
        },
        include: {
          lines: true,
        },
      });

      for (const entry of migratedEntries) {
        const totalDebit = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
        const totalCredit = entry.lines.reduce((sum, line) => sum + Number(line.credit), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          result.inconsistencies.push(
            `Entry ${entry.entryNumber} is unbalanced: Debit ${totalDebit} != Credit ${totalCredit}`
          );
        }
      }

      const cashJournalLines = await prisma.journalEntryLine.findMany({
        where: {
          accountCode: '1001',
          journalEntry: { isPosted: true, referenceType: 'LegacyCashTransaction' },
        },
      });

      const totalDebit = cashJournalLines.reduce((sum, line) => sum + Number(line.debit), 0);
      const totalCredit = cashJournalLines.reduce((sum, line) => sum + Number(line.credit), 0);
      result.reconciliation.newCashBalance = totalDebit - totalCredit;
      result.reconciliation.balanceMatch = Math.abs(result.reconciliation.oldCashBalance - result.reconciliation.newCashBalance) < 0.01;
      result.reconciliation.difference = result.reconciliation.oldCashBalance - result.reconciliation.newCashBalance;
    }

    const successRate = (result.totalMigrated + result.totalSkipped.alreadyMigrated) / result.totalRecords;
    const balanceViolationRate = result.inconsistencies.length / (result.totalMigrated || 1);
    const failureRate = result.totalFailed / result.totalRecords;

    result.financialIntegrityScore = Math.round(
      (successRate * 100) * (1 - balanceViolationRate) * (1 - failureRate)
    );

    result.success = result.errors.length === 0 && result.inconsistencies.length === 0 && result.totalFailed === 0;

    if (result.success && !dryRun) {
      clearCheckpoint();
    }

    return result;
  } catch (error) {
    console.error('Migration failed:', error);
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }
}

// ============================================================================
// VALIDATION SCRIPT
// ============================================================================

export async function validateMigration(): Promise<{
  success: boolean;
  oldCashBalance: number;
  newCashBalance: number;
  balanceMatch: boolean;
  orphanRecords: number;
  unbalancedEntries: number;
}> {
  console.log('\n' + '='.repeat(80));
  console.log('MIGRATION VALIDATION');
  console.log('='.repeat(80));

  let oldCashBalance = 0;
  let newCashBalance = 0;
  let orphanRecords = 0;
  let unbalancedEntries = 0;

  try {
    try {
      const cashTransactions = await prisma.$queryRaw<CashTransactionRecord[]>`
        SELECT * FROM "CashTransaction"
      `;

      const totalIn = cashTransactions
        .filter(r => r.type === 'IN')
        .reduce((sum, r) => sum + Number(r.amount), 0);
      const totalOut = cashTransactions
        .filter(r => r.type === 'OUT')
        .reduce((sum, r) => sum + Number(r.amount), 0);
      oldCashBalance = totalIn - totalOut;
    } catch (error) {
      console.log('CashTransaction table not found - using old balance of 0');
    }

    const cashJournalLines = await prisma.journalEntryLine.findMany({
      where: {
        accountCode: '1001',
        journalEntry: { isPosted: true },
      },
    });

    const totalDebit = cashJournalLines.reduce((sum, line) => sum + Number(line.debit), 0);
    const totalCredit = cashJournalLines.reduce((sum, line) => sum + Number(line.credit), 0);
    newCashBalance = totalDebit - totalCredit;

    const migratedEntries = await prisma.journalEntry.findMany({
      where: {
        referenceType: 'LegacyCashTransaction',
      },
    });

    for (const entry of migratedEntries) {
      try {
        await prisma.$queryRaw`SELECT 1 FROM "CashTransaction" WHERE "id" = ${entry.referenceId} LIMIT 1`;
      } catch (error) {
        orphanRecords++;
      }
    }

    const allMigratedEntries = await prisma.journalEntry.findMany({
      where: {
        referenceType: 'LegacyCashTransaction',
      },
      include: {
        lines: true,
      },
    });

    for (const entry of allMigratedEntries) {
      const totalDebit = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
      const totalCredit = entry.lines.reduce((sum, line) => sum + Number(line.credit), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        unbalancedEntries++;
      }
    }

    const balanceMatch = Math.abs(oldCashBalance - newCashBalance) < 0.01;
    const success = balanceMatch && orphanRecords === 0 && unbalancedEntries === 0;

    console.log(`Old Cash Balance: ${oldCashBalance.toFixed(2)}`);
    console.log(`New Cash Balance: ${newCashBalance.toFixed(2)}`);
    console.log(`Balance Match: ${balanceMatch ? 'YES' : 'NO'}`);
    console.log(`Difference: ${Math.abs(oldCashBalance - newCashBalance).toFixed(2)}`);
    console.log(`Orphan Records: ${orphanRecords}`);
    console.log(`Unbalanced Entries: ${unbalancedEntries}`);
    console.log(`Validation Status: ${success ? 'PASSED' : 'FAILED'}`);
    console.log('='.repeat(80));

    return {
      success,
      oldCashBalance,
      newCashBalance,
      balanceMatch,
      orphanRecords,
      unbalancedEntries,
    };
  } catch (error) {
    console.error('Validation failed:', error);
    throw error;
  }
}

// ============================================================================
// AUDIT-GRADE REPORTING
// ============================================================================

function generateAuditReport(result: MigrationResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT-GRADE MIGRATION REPORT');
  console.log('='.repeat(80));

  console.log('\nCONFIGURATION:');
  console.log(`  Mode: ${result.config.dryRun ? 'DRY-RUN' : 'PRODUCTION'}`);
  console.log(`  Demo Mode: ${result.config.demoMode ? 'YES' : 'NO'}`);
  console.log(`  Batch Size: ${result.config.batchSize}`);
  console.log(`  Auto-Create Accounts: ${result.config.autoCreateAccounts ? 'YES' : 'NO'}`);

  console.log('\nSUMMARY:');
  console.log(`  Total Records: ${result.totalRecords}`);
  console.log(`  Total Migrated: ${result.totalMigrated}`);
  console.log(`  Total Skipped: ${result.totalSkipped.alreadyMigrated + result.totalSkipped.missingAccount + result.totalSkipped.validationError}`);
  console.log(`    - Already Migrated: ${result.totalSkipped.alreadyMigrated}`);
  console.log(`    - Missing Account: ${result.totalSkipped.missingAccount}`);
  console.log(`    - Validation Error: ${result.totalSkipped.validationError}`);
  console.log(`  Total Failed: ${result.totalFailed}`);
  console.log(`  Success Rate: ${((result.totalMigrated + result.totalSkipped.alreadyMigrated) / result.totalRecords * 100).toFixed(2)}%`);

  console.log('\nBATCH PERFORMANCE:');
  result.batches.forEach((batch) => {
    console.log(`  Batch ${batch.batchNumber}:`);
    console.log(`    Processed: ${batch.processed}/${batch.totalRecords}`);
    console.log(`    Migrated: ${batch.migrated}`);
    console.log(`    Skipped: ${batch.skipped.alreadyMigrated + batch.skipped.missingAccount + batch.skipped.validationError}`);
    console.log(`    Failed: ${batch.failed.length}`);
    console.log(`    Duration: ${batch.duration}ms`);
  });

  console.log('\nPERFORMANCE METRICS:');
  console.log(`  Total Time: ${result.performance.totalTime}ms (${(result.performance.totalTime / 1000).toFixed(2)}s)`);
  console.log(`  Avg Time/Batch: ${result.performance.avgTimePerBatch.toFixed(2)}ms`);
  console.log(`  Avg Time/Record: ${result.performance.avgTimePerRecord.toFixed(2)}ms`);

  console.log('\nRECONCILIATION:');
  console.log(`  Old Cash Balance: ${result.reconciliation.oldCashBalance.toFixed(2)}`);
  console.log(`  New Cash Balance: ${result.reconciliation.newCashBalance.toFixed(2)}`);
  console.log(`  Balance Match: ${result.reconciliation.balanceMatch ? 'YES' : 'NO'}`);
  console.log(`  Difference: ${result.reconciliation.difference.toFixed(2)}`);

  console.log('\nFINANCIAL INTEGRITY:');
  console.log(`  Score: ${result.financialIntegrityScore}/100`);
  console.log(`  Status: ${result.financialIntegrityScore >= 95 ? 'EXCELLENT' : result.financialIntegrityScore >= 80 ? 'GOOD' : result.financialIntegrityScore >= 60 ? 'ACCEPTABLE' : 'POOR'}`);

  if (result.errors.length > 0) {
    console.log('\nERRORS:');
    result.errors.forEach((err, index) => {
      console.log(`  ${index + 1}. ${err}`);
    });
  }

  if (result.inconsistencies.length > 0) {
    console.log('\nINCONSISTENCIES:');
    result.inconsistencies.forEach((inc, index) => {
      console.log(`  ${index + 1}. ${inc}`);
    });
  }

  if (result.failedRecords.length > 0) {
    console.log('\nFAILED RECORDS:');
    result.failedRecords.forEach((record, index) => {
      console.log(`  ${index + 1}. ID: ${record.id} - Reason: ${record.reason}`);
    });
  }

  console.log('\nFINAL STATUS:');
  console.log(`  Migration Success: ${result.success ? 'YES' : 'NO'}`);
  console.log(`  Go/No-Go: ${result.success && result.financialIntegrityScore >= 95 ? 'GO' : 'NO-GO'}`);

  console.log('='.repeat(80));
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const demoMode = args.includes('--demo');
  const autoCreate = args.includes('--auto-create');
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || String(BATCH_SIZE));

  const config: MigrationConfig = {
    dryRun,
    demoMode,
    batchSize: isNaN(batchSize) ? BATCH_SIZE : batchSize,
    autoCreateAccounts: autoCreate,
  };

  if (demoMode) {
    console.log('='.repeat(80));
    console.log('CLIENT DEMO MODE');
    console.log('='.repeat(80));
    console.log('This is a demonstration mode with no database writes.');
    console.log('Perfect for client presentations.\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (dryRun) {
    console.log('='.repeat(80));
    console.log('DRY-RUN MODE');
    console.log('='.repeat(80));
    console.log('This is a simulation with no database writes.');
    console.log('Review the report before running the actual migration.\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const migrationResult = await migrateCashTransactions(config);
  generateAuditReport(migrationResult);

  if (!demoMode && !dryRun) {
    const validationResult = await validateMigration();

    console.log('\n' + '='.repeat(80));
    console.log('FINAL DECISION');
    console.log('='.repeat(80));
    console.log(`Migration Success: ${migrationResult.success ? 'YES' : 'NO'}`);
    console.log(`Validation Passed: ${validationResult.success ? 'YES' : 'NO'}`);
    console.log(`Financial Integrity Score: ${migrationResult.financialIntegrityScore}/100`);

    if (migrationResult.success && validationResult.success && migrationResult.financialIntegrityScore >= 95) {
      console.log('\n✅ MIGRATION SUCCESSFUL - GO FOR PRODUCTION');
      console.log('You may now safely drop the CashTransaction table:');
      console.log('  DROP TABLE "CashTransaction";');
    } else {
      console.log('\n❌ MIGRATION HAS ISSUES - NO-GO FOR PRODUCTION');
      console.log('Review the errors and inconsistencies above before proceeding.');
      process.exit(1);
    }
  }

  if (demoMode) {
    console.log('\n' + '='.repeat(80));
    console.log('DEMO COMPLETE');
    console.log('='.repeat(80));
    console.log('This was a demonstration. No data was modified.');
    console.log('Run without --demo flag to execute actual migration.');
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
