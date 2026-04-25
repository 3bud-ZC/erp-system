/**
 * CHART OF ACCOUNTS ANALYSIS SCRIPT
 * 
 * Analyzes account usage and identifies:
 * - Unused accounts (no journal entries)
 * - Active vs inactive accounts
 * - Account balances
 */

import { prisma } from '../lib/db';

async function analyzeChartOfAccounts() {
  console.log('🔍 Analyzing Chart of Accounts...\n');

  // Get all accounts across all tenants
  const accounts = await prisma.account.findMany({
    include: {
      journalLines: {
        select: {
          id: true,
          debit: true,
          credit: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  console.log(`📊 Total Accounts: ${accounts.length}\n`);

  const stats = {
    total: accounts.length,
    active: 0,
    inactive: 0,
    withTransactions: 0,
    withoutTransactions: 0,
    unusedAccounts: [] as any[],
  };

  accounts.forEach((account) => {
    if (account.isActive) {
      stats.active++;
    } else {
      stats.inactive++;
    }

    if (account.journalLines.length > 0) {
      stats.withTransactions++;
    } else {
      stats.withoutTransactions++;
      if (account.isActive) {
        stats.unusedAccounts.push({
          code: account.code,
          nameAr: account.nameAr,
          nameEn: account.nameEn,
          type: account.type,
          balance: Number(account.balance),
        });
      }
    }
  });

  console.log('📈 Statistics:');
  console.log(`  ✅ Active Accounts: ${stats.active}`);
  console.log(`  ❌ Inactive Accounts: ${stats.inactive}`);
  console.log(`  💰 Accounts with Transactions: ${stats.withTransactions}`);
  console.log(`  🔴 Accounts without Transactions: ${stats.withoutTransactions}\n`);

  if (stats.unusedAccounts.length > 0) {
    console.log('⚠️  Unused Active Accounts (candidates for deactivation):');
    stats.unusedAccounts.forEach((acc) => {
      console.log(`  - ${acc.code}: ${acc.nameAr} (${acc.nameEn}) - Balance: ${acc.balance}`);
    });
    console.log();
  } else {
    console.log('✅ All active accounts are being used!\n');
  }

  // Check for orphan journal lines (referencing non-existent accounts)
  const journalLines = await prisma.journalEntryLine.findMany({
    select: {
      accountCode: true,
    },
    distinct: ['accountCode'],
  });

  const accountCodes = new Set(accounts.map((a) => a.code));
  const orphanCodes = journalLines
    .map((l) => l.accountCode)
    .filter((code) => !accountCodes.has(code));

  if (orphanCodes.length > 0) {
    console.log('🚨 INTEGRITY ISSUE: Orphan Journal Lines Found!');
    console.log('   These journal lines reference non-existent accounts:');
    orphanCodes.forEach((code) => {
      console.log(`   - Account Code: ${code}`);
    });
    console.log();
  } else {
    console.log('✅ No orphan journal lines detected\n');
  }

  return stats;
}

// Run analysis
analyzeChartOfAccounts()
  .then((stats) => {
    console.log('✅ Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
