# Accounting System Migration Strategy

## Overview

This document outlines the step-by-step migration strategy for integrating the new accounting system into the existing ERP.

## Prerequisites

1. **Backup existing database**
   ```bash
   pg_dump dbname > backup_before_accounting_migration.sql
   ```

2. **Review existing accounting data**
   - Check if any existing journal entries exist
   - Identify manual accounting records
   - Review current account codes structure

## Migration Steps

### Step 1: Add Accounting Schema to Prisma

**Action:** Merge `prisma/accounting-schema.prisma` into `prisma/schema.prisma`

```bash
# Append accounting schema to main schema
cat prisma/accounting-schema.prisma >> prisma/schema.prisma
```

**What to add:**
- ChartOfAccount model
- JournalEntry model
- JournalEntryLine model
- FiscalYear model
- AccountingPeriod model
- AccountBalance model
- Currency model
- All enums (AccountType, BalanceType, EntryStatus, PeriodType, PeriodStatus)

### Step 2: Generate Prisma Client

```bash
npx prisma generate
```

**Expected:** TypeScript errors in accounting services will be resolved

### Step 3: Create Database Migration

```bash
npx prisma migrate dev --name add_accounting_system
```

**This will create:**
- Migration SQL file
- Database tables
- Indexes
- Constraints

### Step 4: Apply Database Constraints (PostgreSQL)

**Run these SQL commands manually or add to migration:**

```sql
-- Journal entry balance check
ALTER TABLE "JournalEntry" 
  ADD CONSTRAINT "JournalEntry_BalanceCheck" 
  CHECK ("totalDebit" = "totalCredit");

-- Journal entry line mutual exclusivity
ALTER TABLE "JournalEntryLine" 
  ADD CONSTRAINT "JournalEntryLine_MutualExclusivity" 
  CHECK (
    ("debit" > 0 AND "credit" = 0) OR 
    ("credit" > 0 AND "debit" = 0)
  );

-- Journal entry line non-zero
ALTER TABLE "JournalEntryLine" 
  ADD CONSTRAINT "JournalEntryLine_NonZero" 
  CHECK ("debit" > 0 OR "credit" > 0);

-- Posted entries cannot be modified (trigger needed)
-- See Step 7 for trigger implementation

-- Period date validation
ALTER TABLE "AccountingPeriod" 
  ADD CONSTRAINT "AccountingPeriod_DateOrder" 
  CHECK ("startDate" < "endDate");

-- Fiscal year date validation
ALTER TABLE "FiscalYear" 
  ADD CONSTRAINT "FiscalYear_DateOrder" 
  CHECK ("startDate" < "endDate");
```

### Step 5: Create Triggers for Immutable Posted Entries

**Create trigger function:**

```sql
CREATE OR REPLACE FUNCTION prevent_posted_entry_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'POSTED' AND NEW.status = 'POSTED' THEN
    IF NEW.updatedAt > OLD.postedAt THEN
      RAISE EXCEPTION 'Cannot modify posted journal entry';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Create trigger:**

```sql
CREATE TRIGGER prevent_posted_entry_modification_trigger
  BEFORE UPDATE ON "JournalEntry"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_posted_entry_modification();
```

### Step 6: Initialize Chart of Accounts for Existing Tenants

**Run this script for each tenant:**

```typescript
import { chartOfAccountsService } from '@/lib/accounting/chart-of-accounts.service';

async function initializeAccountingForTenant(tenantId: string) {
  await chartOfAccountsService.initializeDefaultChart(tenantId);
}
```

**For all existing tenants:**

```sql
-- Get all tenant IDs
SELECT id FROM "Tenant";

-- For each tenant, run initialization
```

### Step 7: Create Initial Fiscal Year and Periods

**For each tenant:**

```typescript
import { accountingPeriodService } from '@/lib/accounting/period.service';

async function setupFiscalYear(tenantId: string) {
  // Create current fiscal year
  const fiscalYear = await accountingPeriodService.createFiscalYear({
    tenantId,
    name: `FY ${new Date().getFullYear()}`,
    startDate: new Date(new Date().getFullYear(), 0, 1),
    endDate: new Date(new Date().getFullYear(), 11, 31),
  });

  // Generate monthly periods
  await accountingPeriodService.generateMonthlyPeriods(fiscalYear.id, tenantId);
}
```

### Step 8: Register Event Handlers

**Update `lib/events/event-handlers.ts` or create new file:**

```typescript
import { registerAccountingHandlers } from '@/lib/accounting/event-handlers';
import { eventBus } from '@/lib/events/event-bus';

// Register accounting event handlers
registerAccountingHandlers(eventBus);
```

**Add to application startup:**

```typescript
// app/api/[...nextauth]/route.ts or similar startup file
import { registerAccountingHandlers } from '@/lib/accounting/event-handlers';
import { eventBus } from '@/lib/events/event-bus';

registerAccountingHandlers(eventBus);
```

### Step 9: Register Validation Engine Validator

**Update validation engine:**

```typescript
import { journalEntryValidator } from '@/lib/accounting/validation.service';

// Register with validation engine
validationEngine.registerValidator('journal_entry', journalEntryValidator);
```

### Step 10: Update Existing Accounting Module

**Replace `lib/accounting.ts` with new implementation:**

The existing `lib/accounting.ts` has basic double-entry logic. Replace it with the new comprehensive system:

```typescript
// lib/accounting.ts (NEW)
export * from './accounting/accounting.service';
export * from './accounting/journal-entry.service';
export * from './accounting/chart-of-accounts.service';
export * from './accounting/period.service';
```

### Step 11: Test Integration

**Test scenarios:**

1. **Create journal entry via API**
   ```bash
   POST /api/accounting/journal-entries
   ```

2. **Post journal entry**
   ```bash
   POST /api/accounting/journal-entries/{id}/post
   ```

3. **Check balances**
   ```bash
   GET /api/accounting/balances?accountCode=1010
   ```

4. **Test event handler**
   - Create sales invoice
   - Verify accounting entry is created automatically

5. **Test period closing**
   ```bash
   POST /api/accounting/periods/{id}/close
   ```

### Step 12. Data Migration (If Existing Accounting Data)

**If you have existing journal entries:**

```typescript
async function migrateExistingJournalEntries() {
  // 1. Read existing entries from old format
  const oldEntries = await prisma.oldJournalEntry.findMany();

  // 2. Transform to new format
  for (const oldEntry of oldEntries) {
    await journalEntryService.createDraftEntry({
      tenantId: oldEntry.tenantId,
      entryDate: oldEntry.date,
      description: oldEntry.description,
      lines: oldEntry.lines.map(line => ({
        accountCode: line.accountCode,
        debit: line.debit,
        credit: line.credit,
      })),
    });
  }

  // 3. Post all entries
  for (const entry of newEntries) {
    await journalEntryService.postEntry({
      tenantId: entry.tenantId,
      entryId: entry.id,
      postedBy: 'migration',
    });
  }
}
```

### Step 13. Rebuild Balances

**After data migration, rebuild balances:**

```typescript
async function rebuildAllBalances(tenantId: string) {
  const accounts = await chartOfAccountsService.listAccounts(tenantId);

  for (const account of accounts) {
    await accountingService.rebuildBalance(account.code, tenantId);
  }
}
```

### Step 14. Final Verification

**Checklist:**

- [ ] All accounting tables created
- [ ] Indexes created correctly
- [ ] Constraints applied
- [ ] Triggers created
- [ ] Chart of accounts initialized for all tenants
- [ ] Fiscal years and periods created
- [ ] Event handlers registered
- [ ] Validation engine updated
- [ ] API routes tested
- [ ] Event-driven integration tested
- [ ] Balances calculated correctly
- [ ] Trial balance balances

### Step 15. Rollback Plan (If Needed)

**If migration fails:**

```bash
# Rollback database migration
npx prisma migrate resolve --rolled-back add_accounting_system

# Restore backup
psql dbname < backup_before_accounting_migration.sql

# Remove accounting schema from schema.prisma
# Regenerate Prisma client
npx prisma generate
```

## Post-Migration Tasks

### 1. Monitor Event Processing

- Check outbox table for failed events
- Monitor event bus queue sizes
- Verify accounting entries are created for all domain events

### 2. Performance Monitoring

- Monitor journal entry query performance
- Check balance calculation performance
- Monitor trial balance generation time

### 3. User Training

- Train users on new journal entry workflow
- Explain period closing process
- Document account hierarchy

### 4. Documentation Updates

- Update API documentation
- Update user guides
- Document custom account codes

## Timeline Estimate

- **Steps 1-4 (Schema & Migration):** 2 hours
- **Steps 5-7 (Constraints & Triggers):** 1 hour
- **Steps 8-9 (Registration):** 30 minutes
- **Step 10 (Module Replacement):** 30 minutes
- **Step 11 (Testing):** 2 hours
- **Step 12 (Data Migration):** Variable (if needed)
- **Step 13 (Balance Rebuild):** 1 hour
- **Step 14 (Verification):** 1 hour

**Total (without data migration):** ~8 hours

## Risk Mitigation

1. **Backup before migration** - Always have a fresh backup
2. **Test in staging first** - Never migrate to production without staging test
3. **Gradual rollout** - Enable accounting for one tenant at a time
4. **Monitor closely** - Watch for errors and performance issues
5. **Rollback ready** - Have rollback plan ready before starting
