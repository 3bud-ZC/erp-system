# Accounting System Risks & Edge Cases

## Critical Risks

### 1. Double-Entry Balance Violation

**Risk:** Database constraint enforcement fails, allowing unbalanced entries

**Mitigation:**
- Application-level validation before database write
- Database CHECK constraint for totalDebit = totalCredit
- Transaction rollback on validation failure
- Monitoring for constraint violations

**Code Protection:**
```typescript
// Application level
private calculateTotals(lines: JournalEntryLineInput[]) {
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) >= 0.01) {
    throw new Error(`Journal entry does not balance`);
  }

  return { totalDebit, totalCredit };
}

// Database level
ALTER TABLE "JournalEntry" 
  ADD CONSTRAINT "JournalEntry_BalanceCheck" 
  CHECK ("totalDebit" = "totalCredit");
```

### 2. Multi-Tenant Data Leakage

**Risk:** Tenant A sees tenant B's accounting data

**Mitigation:**
- All queries include tenantId filter
- Prisma middleware enforces tenant isolation
- Row-Level Security (RLS) in PostgreSQL
- Regular audits of cross-tenant access

**Implementation:**
```typescript
// Prisma middleware
prisma.$use(async (params, next) => {
  if (params.model && ['JournalEntry', 'ChartOfAccount'].includes(params.model)) {
    params.args.where = {
      ...params.args.where,
      tenantId: getCurrentTenantId(),
    };
  }
  return next(params);
});
```

### 3. Posted Entry Modification

**Risk:** User modifies posted journal entry, corrupting financial data

**Mitigation:**
- Database trigger prevents modification
- Application-level check before update
- Status change from POSTED to DRAFT not allowed
- Audit log for all modifications

**Implementation:**
```sql
CREATE TRIGGER prevent_posted_entry_modification_trigger
  BEFORE UPDATE ON "JournalEntry"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_posted_entry_modification();
```

### 4. Closed Period Posting

**Risk:** User posts entry to closed accounting period

**Mitigation:**
- Validation checks period status before posting
- Database constraint prevents posting to closed periods
- Period status change requires special permissions
- Audit trail for period closures

### 5. Race Conditions in Balance Updates

**Risk:** Concurrent journal entries update balance incorrectly

**Mitigation:**
- Balance updates within same transaction as journal entry
- Use Prisma's atomic increment operations
- Optimistic locking with version field (if needed)
- Rebuild balance function for recovery

**Implementation:**
```typescript
await tx.accountBalance.update({
  where: { id: existingBalance.id },
  data: {
    balance: { increment: balanceChange }, // Atomic
    debitTotal: { increment: debit },
    creditTotal: { increment: credit },
  },
});
```

### 6. Event Handler Failure

**Risk:** Event handler fails, leaving accounting entries uncreated

**Mitigation:**
- Retry mechanism with exponential backoff
- Outbox pattern for reliable event delivery
- Dead letter queue for permanently failed events
- Manual intervention workflow

**Implementation:**
```typescript
// Event handler with retry
try {
  await accountingService.recordSales(input);
} catch (error) {
  // Retry mechanism will handle
  throw error; // Re-throw to trigger retry
}
```

### 7. Balance Cache Inconsistency

**Risk:** Cached balance doesn't match actual journal entries

**Mitigation:**
- Balance updated in same transaction as journal entry
- Rebuild balance function available
- Cache invalidation on entry posting
- Periodic balance reconciliation

**Recovery:**
```typescript
await accountingService.rebuildBalance(accountCode, tenantId);
```

## Edge Cases

### 1. Zero-Amount Journal Entries

**Scenario:** User creates entry with all zero amounts

**Handling:**
- Validation rejects zero-amount lines
- Each line must have either debit or credit > 0
- Total entry must have non-zero balance

```typescript
if (line.debit === 0 && line.credit === 0) {
  throw new Error('Line must have either debit or credit');
}
```

### 2. Single-Line Journal Entries

**Scenario:** User tries to create entry with only one line

**Handling:**
- Validation requires minimum 2 lines
- Double-entry bookkeeping requires at least debit and credit

```typescript
if (lines.length < 2) {
  throw new Error('Journal entry must have at least 2 lines');
}
```

### 3. Future-Dated Entries

**Scenario:** User posts entry with future date

**Handling:**
- Warning for entries > 30 days in future
- Error for entries > 1 year in future
- Validation check before posting

```typescript
if (input.entryDate > new Date()) {
  errors.push({
    code: 'FUTURE_DATE',
    severity: 'error',
    message: 'Entry date cannot be in the future',
  });
}
```

### 4. Account Code Deletion

**Scenario:** User tries to delete account with journal entries

**Handling:**
- Prevent deletion if account has journal entries
- Mark as inactive instead of deleting
- Allow deletion only if no entries exist

```typescript
const hasEntries = await prisma.journalEntryLine.findFirst({
  where: { accountCode },
});

if (hasEntries) {
  throw new Error('Cannot delete account with journal entries');
}
```

### 5. Period Reopening

**Scenario:** User needs to reopen closed period

**Handling:**
- Only allowed if fiscal year is not closed
- Requires special permissions
- Audit trail for reopen action
- Warning about impact on reports

```typescript
if (fiscalYear.isClosed) {
  throw new Error('Cannot reopen period when fiscal year is closed');
}
```

### 6. Entry Reversal of Reversal

**Scenario:** User tries to reverse an already reversed entry

**Handling:**
- Check if entry already has reversalEntryId
- Prevent double reversal
- Create new reversal of reversal if needed

```typescript
if (entry.reversalEntryId) {
  throw new Error('Entry already reversed');
}
```

### 7. Multi-Currency Entry

**Scenario:** Entry uses different currency than account currency

**Handling:**
- Validate exchange rate provided
- Convert amounts to base currency
- Store both original and converted amounts
- FX gain/loss accounting

```typescript
if (line.currencyId && line.currencyId !== account.currencyId) {
  if (!line.exchangeRate) {
    throw new Error('Exchange rate required for multi-currency entry');
  }
}
```

### 8. Large Volume Journal Entries

**Scenario:** Entry with hundreds of lines

**Handling:**
- Batch line creation in chunks
- Use transaction for atomicity
- Monitor performance
- Consider splitting into multiple entries

```typescript
// Process in batches of 100 lines
const batchSize = 100;
for (let i = 0; i < lines.length; i += batchSize) {
  const batch = lines.slice(i, i + batchSize);
  await processBatch(batch);
}
```

### 9. Concurrent Period Closing

**Scenario:** Two users try to close same period simultaneously

**Handling:**
- Database transaction with lock
- Optimistic locking with version field
- First request succeeds, second fails

```typescript
await prisma.$transaction(async (tx) => {
  const period = await tx.accountingPeriod.findUnique({
    where: { id: periodId },
  });

  if (period.status !== 'OPEN') {
    throw new Error('Period already closed');
  }

  await tx.accountingPeriod.update({
    where: { id: periodId },
    data: { status: 'CLOSED' },
  });
});
```

### 10. Chart of Account Cycles

**Scenario:** Parent-child account relationship creates cycle

**Handling:**
- Validate parent is not descendant of child
- Use materialized path for hierarchy validation
- Trigger to prevent cycles

```typescript
if (newPath.startsWith(childPath + '/')) {
  throw new Error('Cannot create circular account hierarchy');
}
```

## Performance Considerations

### 1. Balance Calculation Performance

**Risk:** Real-time balance calculation slow with millions of entries

**Mitigation:**
- Use cached balances (AccountBalance table)
- Update cache in same transaction as entry
- Rebuild cache periodically
- Use materialized views for complex queries

### 2. Trial Balance Generation

**Risk:** Trial balance query slow with many accounts

**Mitigation:**
- Use cached balances
- Parallel query execution
- Incremental calculation
- Cache trial balance results

### 3. Journal Entry Listing

**Risk:** Listing all entries slow with large dataset

**Mitigation:**
- Pagination (default 50, max 1000)
- Index on entryDate, tenantId, status
- Filter by date range
- Use cursor-based pagination for large datasets

### 4. Event Handler Throughput

**Risk:** Event handlers can't keep up with event volume

**Mitigation:**
- Batch event processing
- Horizontal scaling of event bus
- Queue-based processing with Redis
- Monitor queue depth

## Data Integrity

### 1. Orphaned Journal Entry Lines

**Risk:** Lines without parent entry due to deletion

**Mitigation:**
- Foreign key with CASCADE delete
- Never delete posted entries
- Use soft delete if needed

```prisma
lines JournalEntryLine[] @relation("JournalEntryLines", fields: [journalEntryId], references: [id], onDelete: Cascade)
```

### 2. Missing Account Balances

**Risk:** Balance record missing for account

**Mitigation:**
- Create balance on first entry
- Rebuild balance function
- Periodic balance reconciliation

### 3. Fiscal Year Gaps

**Risk:** Gaps between fiscal years

**Mitigation:**
- Validation on fiscal year creation
- Check for overlapping years
- Require continuous fiscal years

## Security Considerations

### 1. Privilege Escalation

**Risk:** User posts entry without permission

**Mitigation:**
- Role-based access control
- Permission checks in API routes
- Audit trail of all actions

```typescript
if (!user.permissions.includes('post_journal_entry')) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

### 2. Data Tampering

**Risk:** Direct database modification bypassing application

**Mitigation:**
- Database triggers for critical operations
- Immutable posted entries
- Audit logging
- Regular reconciliation

### 3. SQL Injection

**Risk:** Malicious input in account codes or descriptions

**Mitigation:**
- Prisma parameterized queries
- Input validation and sanitization
- Use prepared statements

## Monitoring & Alerts

### Critical Alerts

1. **Unbalanced journal entries detected**
   - Alert immediately
   - Investigate and fix
   - Review constraint logs

2. **Cross-tenant data access detected**
   - Alert immediately
   - Security incident
   - Review access logs

3. **Posted entry modification attempt**
   - Alert immediately
   - Investigate user
   - Review audit logs

4. **Period closed with open entries**
   - Warning
   - Review entries
   - May need to reopen period

5. **Balance cache inconsistency**
   - Warning
   - Rebuild balances
   - Investigate cause

### Metrics to Monitor

- Journal entry creation rate
- Balance calculation latency
- Trial balance generation time
- Event handler success rate
- Failed event count
- Queue depth
- Database query performance

## Recovery Procedures

### 1. Restore from Backup

**When:** Data corruption detected

**Steps:**
1. Stop application
2. Restore database from backup
3. Replay events from outbox after backup point
4. Rebuild balances
5. Verify trial balance

### 2. Rebuild All Balances

**When:** Balance corruption detected

**Steps:**
1. Identify affected accounts
2. Run rebuild balance function
3. Verify against journal entries
4. Update cache
5. Monitor for recurrence

### 3. Event Replay

**When:** Event handler missed events

**Steps:**
1. Identify missed events from outbox
2. Manually trigger event handlers
3. Verify accounting entries created
4. Update event status

## Testing Strategy

### Unit Tests

- Balance calculation logic
- Entry validation rules
- Account hierarchy validation
- Period status checks

### Integration Tests

- End-to-end journal entry creation
- Event handler integration
- Balance update on posting
- Period closing workflow

### Load Tests

- 1000 concurrent journal entries
- Trial balance with 10,000 accounts
- Event handler throughput
- Balance query performance

### Security Tests

- Cross-tenant access attempts
- Privilege escalation attempts
- SQL injection attempts
- Posted entry modification attempts

## Conclusion

This accounting system is designed with multiple layers of protection:

1. **Application-level validation** - Pre-commit checks
2. **Database constraints** - CHECK constraints and triggers
3. **Transaction safety** - All operations in transactions
4. **Audit logging** - Complete audit trail
5. **Monitoring** - Real-time alerts
6. **Recovery procedures** - Well-documented recovery steps

The system prioritizes financial data integrity above all else, with multiple fail-safes to prevent corruption.
