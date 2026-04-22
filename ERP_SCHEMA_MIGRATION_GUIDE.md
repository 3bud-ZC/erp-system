# ERP Schema Migration Guide

**Purpose:** Production-grade migration for critical schema fixes to ensure multi-tenant isolation, concurrency safety, and event-driven architecture.

---

## Critical Changes Applied

### 1. Multi-Tenant Isolation Fixes (CRITICAL)

**Problem:** AccountingPeriod, Account, and JournalEntryLine tables were missing `tenantId`, violating multi-tenant security rules.

**Fixes Applied:**
- Added `tenantId` field to `AccountingPeriod`
- Added `tenantId` field to `Account`
- Added `tenantId` field to `JournalEntryLine`
- Changed `Account.code` unique constraint to composite unique `[tenantId, code]`
- Added tenant relations to all affected models

**Impact:** Cross-tenant data access is now impossible at database level.

---

### 2. Optimistic Locking (CRITICAL)

**Problem:** No concurrency control on Product stock updates, leading to race conditions and stock inconsistencies.

**Fix Applied:**
- Added `version Int @default(0)` field to `Product` model
- Refactored all inventory operations to use optimistic locking

**Impact:** Concurrent stock updates are now safe - if two users update the same product simultaneously, the second update will fail with a version conflict error.

---

### 3. Event-Driven Architecture (CRITICAL)

**Problem:** No outbox pattern for reliable event delivery, risking lost events during failures.

**Fixes Applied:**
- Added `FiscalYear` model for proper accounting period management
- Added `OutboxEvent` model for outbox pattern
- Updated `JournalEntry` to reference FiscalYear and AccountingPeriod
- Added reversal support to JournalEntry
- Added `sourceEventId` and `correlationId` for event tracing

**Impact:** Events are now reliably persisted within transactions and can be retried on failure.

---

## Migration Steps

### Step 1: Backup Database

```bash
pg_dump dbname > backup_before_erp_migration.sql
```

### Step 2: Run Prisma Migration

```bash
npx prisma migrate dev --name fix_multi_tenant_and_add_event_system
```

This will:
- Add `tenantId` columns to AccountingPeriod, Account, JournalEntryLine
- Add `version` column to Product
- Add FiscalYear model
- Add OutboxEvent model
- Update JournalEntry with new fields
- Create necessary indexes

### Step 3: Apply Database Constraints

```bash
psql dbname < DATABASE_CONSTRAINTS_SQL.sql
```

This will:
- Add double-entry balance check constraint
- Add stock non-negative constraint
- Add period posting prevention triggers
- Add posted entry immutability triggers
- Add optimistic locking trigger for Product
- Add business rule constraints

### Step 4: Apply Performance Indexes

```bash
psql dbname < PERFORMANCE_INDEXES_SQL.sql
```

This will:
- Add composite indexes for multi-tenant queries
- Add indexes for accounting performance
- Add indexes for inventory performance
- Add indexes for event processing

### Step 5: Regenerate Prisma Client

```bash
npx prisma generate
```

This will:
- Update TypeScript types to reflect new schema
- Resolve TypeScript errors in inventory-transactions.ts

### Step 6: Data Migration for Existing Data

**For existing AccountingPeriod records:**
```sql
-- Assign all existing AccountingPeriod records to a default tenant
-- This is a placeholder - you need to determine the correct tenantId for each period
UPDATE "AccountingPeriod" SET "tenantId" = 'DEFAULT_TENANT_ID' WHERE "tenantId" IS NULL;
```

**For existing Account records:**
```sql
-- Assign all existing Account records to a default tenant
UPDATE "Account" SET "tenantId" = 'DEFAULT_TENANT_ID' WHERE "tenantId" IS NULL;
```

**For existing JournalEntryLine records:**
```sql
-- Assign all existing JournalEntryLine records to match their journal entry's tenant
UPDATE "JournalEntryLine" j
SET "tenantId" = e."tenantId"
FROM "JournalEntry" e
WHERE j."journalEntryId" = e.id AND j."tenantId" IS NULL;
```

**For existing Product records:**
```sql
-- Initialize version field for existing products
UPDATE "Product" SET "version" = 0 WHERE "version" IS NULL;
```

### Step 7: Initialize Fiscal Years and Periods

For each tenant, run:
```typescript
import { prisma } from '@/lib/db';

async function initializeAccountingPeriods(tenantId: string) {
  // Create fiscal year for current year
  const fiscalYear = await prisma.fiscalYear.create({
    data: {
      name: `FY ${new Date().getFullYear()}`,
      year: new Date().getFullYear(),
      startDate: new Date(new Date().getFullYear(), 0, 1),
      endDate: new Date(new Date().getFullYear(), 11, 31),
      tenantId,
    },
  });

  // Create monthly periods
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  for (let i = 0; i < 12; i++) {
    const startDate = new Date(new Date().getFullYear(), i, 1);
    const endDate = new Date(new Date().getFullYear(), i + 1, 0);
    
    await prisma.accountingPeriod.create({
      data: {
        name: months[i],
        startDate,
        endDate,
        fiscalYearId: fiscalYear.id,
        tenantId,
      },
    });
  }
}
```

### Step 8: Update Existing Journal Entries

Link existing journal entries to fiscal years and periods:
```typescript
async function linkJournalEntriesToFiscalYears(tenantId: string) {
  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { tenantId, year: new Date().getFullYear() },
  });

  if (!fiscalYear) {
    throw new Error('Fiscal year not found for current year');
  }

  const openPeriod = await prisma.accountingPeriod.findFirst({
    where: { 
      tenantId,
      fiscalYearId: fiscalYear.id,
      status: 'open',
    },
  });

  await prisma.journalEntry.updateMany({
    where: { 
      tenantId,
      fiscalYearId: null,
    },
    data: {
      fiscalYearId: fiscalYear.id,
      accountingPeriodId: openPeriod?.id,
    },
  });
}
```

### Step 9: Verify Migration

Run these checks:

```sql
-- Check all AccountingPeriod records have tenantId
SELECT COUNT(*) FROM "AccountingPeriod" WHERE "tenantId" IS NULL;

-- Check all Account records have tenantId
SELECT COUNT(*) FROM "Account" WHERE "tenantId" IS NULL;

-- Check all JournalEntryLine records have tenantId
SELECT COUNT(*) FROM "JournalEntryLine" WHERE "tenantId" IS NULL;

-- Check all Product records have version
SELECT COUNT(*) FROM "Product" WHERE "version" IS NULL;

-- Verify constraints exist
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name IN ('JournalEntry', 'Product', 'AccountingPeriod');
```

All should return 0.

### Step 10: Test Application

1. Start application
2. Create a sales invoice
3. Verify OutboxEvent is created
4. Verify journal entry is created with fiscalYearId
5. Verify stock update uses optimistic locking

---

## Rollback Plan

If migration fails:

```bash
# Rollback database migration
npx prisma migrate resolve --rolled-back fix_multi_tenant_and_add_event_system

# Restore backup
psql dbname < backup_before_erp_migration.sql

# Regenerate Prisma client with old schema
npx prisma generate
```

---

## Post-Migration Tasks

1. **Update application code** to use new fields:
   - Use `tenantId` in all accounting queries
   - Use `version` field in product updates
   - Emit events to OutboxEvent table
   - Link journal entries to fiscal years and periods

2. **Register event handlers** for outbox processing:
   - Create background job to process pending events
   - Implement retry mechanism with exponential backoff
   - Monitor event processing failures

3. **Update validation engine** to check:
   - Accounting period is open
   - Fiscal year is not closed
   - Journal entry balances
   - Stock availability with version check

4. **Monitor performance**:
   - Check query performance with new indexes
   - Monitor event queue depth
   - Track version conflict errors

---

## Risk Assessment

### High Risk
- **Data migration for tenantId**: Must correctly assign tenantId to existing data
- **Journal entry linking**: Must correctly link to fiscal years and periods

### Medium Risk
- **Performance impact**: New indexes may slow down writes initially
- **Application compatibility**: Existing code may need updates for new fields

### Low Risk
- **Schema changes**: Prisma handles most changes safely
- **Constraint addition**: Existing data should satisfy new constraints

---

## Timeline Estimate

- **Steps 1-4 (Migration):** 2 hours
- **Step 5 (Generate):** 5 minutes
- **Step 6 (Data migration):** 1-2 hours (depends on data volume)
- **Step 7 (Initialize periods):** 30 minutes per tenant
- **Step 8 (Link entries):** 30 minutes
- **Step 9-10 (Verify):** 30 minutes

**Total:** 4-6 hours

---

## Success Criteria

Migration is successful when:
- [ ] All tables have proper tenantId
- [ ] All products have version field
- [ ] All database constraints are active
- [ ] All performance indexes are created
- [ ] Prisma client generates without errors
- [ ] Existing data is correctly migrated
- [ ] Application starts without errors
- [ ] Event outbox pattern works correctly
- [ ] Optimistic locking works correctly
