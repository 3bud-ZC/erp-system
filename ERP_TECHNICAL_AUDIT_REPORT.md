# ERP Backend Deep Technical Audit Report

**Date:** 2026-04-21  
**Scope:** Production-scale multi-tenant ERP system  
**Focus:** Data integrity, multi-tenant isolation, transaction safety, production risks

---

## CRITICAL ISSUES (Production-Blocking)

### 1. **CRITICAL: Session.tenantId is Optional - Multi-Tenant Data Leakage Vulnerability**

**Location:** `prisma/schema.prisma` line 1238
```prisma
model Session {
  tenantId   String?  // ❌ OPTIONAL - CRITICAL SECURITY FLAW
```

**Why This Is Dangerous:**
Sessions can exist without tenant context. Any code path that creates or uses a session without setting `tenantId` can access data across all tenants. This violates the fundamental principle of multi-tenant isolation.

**Realistic Failure Scenario:**
1. A user logs in during a system migration or initialization where tenant context isn't set
2. The session is created with `tenantId = null`
3. Subsequent API calls using this session bypass tenant middleware (line 42-45 of `prisma-tenant-middleware.ts`)
4. The user can query/update data from ALL tenants
5. This could expose financial data, customer information, and inventory across the entire system

**Fix:**
```prisma
model Session {
  tenantId   String   // ❌ REMOVE the optional marker
  ...
  @@index([tenantId]) // Ensure index exists
}
```

```typescript
// In session creation code, enforce tenantId:
if (!tenantId) {
  throw new Error('tenantId is required for session creation');
}
```

**Architecture-Level Fix:**
Implement database-level Row Level Security (RLS) policies in PostgreSQL to enforce tenant isolation at the database level, preventing any application-level bypass.

---

### 2. **CRITICAL: Tenant Middleware Bypass When No Context Set**

**Location:** `lib/prisma-tenant-middleware.ts` lines 42-45
```typescript
// Skip if no tenant context (e.g., during migrations)
if (!currentTenantId) {
  return next(params);  // ❌ BYPASSES ALL TENANT FILTERING
}
```

**Why This Is Dangerous:**
The middleware explicitly bypasses tenant filtering when no context is set. This is a "backdoor" that can be exploited. Any code that fails to set tenant context (due to bugs, race conditions, or malicious intent) will have unrestricted access to all tenant data.

**Realistic Failure Scenario:**
1. A race condition in the auth middleware causes `setTenantContext()` to not be called before a query executes
2. The query executes with `currentTenantId = null`
3. The middleware bypasses tenant filtering
4. The query returns data from all tenants
5. This could happen during high-load scenarios where async operations complete out of order

**Fix:**
```typescript
// NEVER bypass tenant filtering - throw explicit error instead
if (!currentTenantId) {
  throw new Error('Tenant context is required for all database operations');
}
```

**Architecture-Level Fix:**
Implement a tenant context provider pattern where tenant context is guaranteed to be set at the request level, with fallback to throw if missing.

---

### 3. **CRITICAL: System Models Excluded From Tenant Isolation**

**Location:** `lib/prisma-tenant-middleware.ts` lines 21-35
```typescript
const systemModels = [
  'User',           // ❌ Should be tenant-scoped
  'Role',           // ❌ Should be tenant-scoped
  'Permission',     // ❌ Should be tenant-scoped
  'Account',        // ❌ Should be tenant-scoped
  // ...
];
```

**Why This Is Dangerous:**
In a multi-tenant ERP, users, roles, permissions, and chart of accounts should be tenant-specific. Excluding these from tenant isolation means:
- Tenant A can see Tenant B's users
- Tenant A can modify Tenant B's permissions
- Tenant A can access Tenant B's chart of accounts
- Cross-tenant permission escalation is possible

**Realistic Failure Scenario:**
1. Tenant A's administrator queries all users
2. Since User model is excluded from tenant isolation, they see ALL users across ALL tenants
2. They can modify roles or permissions for users in other tenants
4. This gives them administrative access to other tenants' data

**Fix:**
```prisma
// Add tenantId to all models that should be tenant-scoped:
model User {
  tenantId String  // ❌ MISSING - MUST ADD
  ...
  @@index([tenantId])
}

model Role {
  tenantId String  // ❌ MISSING - MUST ADD
  ...
  @@index([tenantId])
}

model Account {
  tenantId String  // ❌ MISSING - MUST ADD
  ...
  @@index([tenantId])
}
```

Remove these models from the `systemModels` array in the middleware.

---

### 4. **CRITICAL: InventoryTransaction Lacks Database Constraints**

**Location:** `prisma/schema.prisma` lines 645-668

**Issues:**
- No unique constraint on `(productId, type, referenceId, date)` - duplicate transactions can be created
- No check constraint for `quantity` (can be negative, zero, or extremely large)
- No check constraint for `type` (String instead of enum)
- No foreign key constraint to ensure `referenceId` points to valid entity
- No constraint to prevent negative stock at database level

**Why This Is Dangerous:**
1. **Duplicate Transactions:** The same inventory change can be recorded multiple times, leading to incorrect stock levels
2. **Invalid Quantities:** Negative quantities can be recorded directly, bypassing application logic
3. **Invalid Types:** Any string can be used as a transaction type, breaking reporting and aggregation
4. **Orphaned References:** Transactions can reference non-existent entities

**Realistic Failure Scenario:**
1. A network timeout occurs during invoice creation
2. The client retries the request
3. The server creates the invoice twice
4. Stock is decremented twice (double-counting)
5. InventoryTransaction records are duplicated
6. Stock levels are now incorrect and difficult to reconcile

**Fix:**
```prisma
model InventoryTransaction {
  id            String   @id @default(cuid())
  productId     String
  type          String   // ❌ CHANGE TO ENUM
  quantity      Float
  referenceId   String?
  referenceType String?
  unitCost      Float?
  totalCost     Float?
  warehouseId   String?
  date          DateTime
  notes         String?
  tenantId      String
  createdAt     DateTime @default(now())
  product       Product  @relation("InventoryTransactions", fields: [productId], references: [id])
  tenant        Tenant   @relation(fields: [tenantId], references: [id])

  @@index([productId])
  @@index([type])
  @@index([date])
  @@index([referenceId])
  @@index([tenantId])
  @@index([warehouseId])
  @@unique([productId, type, referenceId, date])  // ✅ ADD: Prevent duplicates
}

// ✅ ADD: Enum for transaction types
enum TransactionType {
  PURCHASE
  SALE
  PRODUCTION_IN
  PRODUCTION_OUT
  ADJUSTMENT
  RETURN
  PURCHASE_RETURN
}

// ✅ ADD: Database-level check constraint (requires raw SQL)
// ALTER TABLE "InventoryTransaction" 
// ADD CONSTRAINT "check_quantity_positive" CHECK (quantity != 0);
// ALTER TABLE "InventoryTransaction" 
// ADD CONSTRAINT "check_quantity_range" CHECK (quantity > -1000000 AND quantity < 1000000);
```

---

### 5. **CRITICAL: Product.stock Can Go Negative - No Database Protection**

**Location:** `prisma/schema.prisma` lines 192-221

**Issue:**
```prisma
model Product {
  stock  Float  @default(0)  // ❌ No constraint to prevent negative values
  ...
}
```

**Why This Is Dangerous:**
The `stock` field has no database-level constraint to prevent negative values. While application logic prevents this, it can be bypassed by:
1. Direct SQL updates
2. Bugs in application code
3. Race conditions in concurrent updates
4. Malicious database access

**Realistic Failure Scenario:**
1. Two users simultaneously try to sell the last 5 units of a product
2. Both pass the `atomicDecrementStock` check (both see stock >= 5)
3. Both decrement stock by 5
4. Stock becomes -5 (negative)
5. Future operations break because negative stock is not handled
6. Financial calculations are incorrect
7. Inventory reports show impossible values

**Fix:**
```prisma
model Product {
  stock  Float  @default(0)
  ...
}

// ✅ ADD: Database-level check constraint (requires raw SQL)
// ALTER TABLE "Product" 
// ADD CONSTRAINT "check_stock_non_negative" CHECK (stock >= 0);
```

**Architecture-Level Fix:**
Implement optimistic concurrency control using a `version` field:
```prisma
model Product {
  stock    Float   @default(0)
  version Int     @default(0)  // ✅ ADD: Optimistic concurrency
  ...
}

// ✅ ADD: Unique constraint on (id, version) for optimistic locking
// @@unique([id, version])
```

Update all stock update logic to include version check:
```typescript
await tx.product.update({
  where: { 
    id: productId,
    version: currentVersion  // ✅ Only update if version hasn't changed
  },
  data: { 
    stock: { increment: quantity },
    version: { increment: 1 }
  }
});
```

---

### 6. **CRITICAL: No Optimistic Concurrency Control - Lost Updates**

**Location:** All stock update operations in `lib/inventory-transactions.ts`

**Issue:**
The system uses `atomicDecrementStock` for single-row atomic updates, but there is no optimistic concurrency control for general stock updates. Concurrent updates can lead to lost updates.

**Why This Is Dangerous:**
1. User A reads product stock: 100
2. User B reads product stock: 100
3. User A decrements stock by 10: stock = 90
4. User B decrements stock by 20: stock = 80 (expected: 70)
5. User A's update is lost

**Realistic Failure Scenario:**
1. A high-volume sales day with multiple cashiers
2. Two cashiers sell the same product simultaneously
3. Both read stock before the other's update commits
4. The later update overwrites the earlier one
5. Stock levels become inconsistent
6. Revenue and inventory calculations are incorrect

**Fix:**
Add a `version` field to `Product` model (see issue #5) and implement optimistic concurrency control in all stock update operations.

---

### 7. **CRITICAL: JournalEntryLine Lacks TenantId - Cross-Tenant Data Leakage**

**Location:** `prisma/schema.prisma` lines 922-936
```prisma
model JournalEntryLine {
  id             String       @id @default(cuid())
  journalEntryId String
  accountCode    String
  debit          Decimal      @default(0)
  credit         Decimal      @default(0)
  description    String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  account        Account      @relation(fields: [accountCode], references: [code])
  journalEntry   JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)

  @@index([journalEntryId])
  @@index([accountCode])
  // ❌ NO tenantId - relies only on parent relationship
}
```

**Why This Is Dangerous:**
JournalEntryLine doesn't have `tenantId`. While it has a foreign key to `JournalEntry` (which has `tenantId`), this creates a security risk:
1. If the tenant middleware has a bug or is bypassed, lines can be queried without tenant filtering
2. Direct SQL queries can access lines across tenants
3. Aggregation queries on lines could leak cross-tenant data

**Realistic Failure Scenario:**
1. A developer writes a query to aggregate all journal entry lines for reporting
2. They forget to join with JournalEntry to filter by tenant
3. The query returns lines from all tenants
4. Financial reports include data from other tenants
5. This violates data privacy and could lead to legal issues

**Fix:**
```prisma
model JournalEntryLine {
  tenantId String  // ✅ ADD
  ...
  @@index([journalEntryId])
  @@index([accountCode])
  @@index([tenantId])  // ✅ ADD
}
```

Update the tenant middleware to include `JournalEntryLine` in the tenant filtering logic.

---

### 8. **CRITICAL: Accounting Module Lacks Database-Level Validation**

**Location:** `lib/accounting.ts` and `prisma/schema.prisma`

**Issues:**
- No database constraint to ensure journal entries balance (totalDebit == totalCredit)
- No constraint to prevent posting entries with zero lines
- No constraint to prevent posting entries with all zero amounts
- No foreign key constraint to ensure accountCode points to valid Account
- No constraint to prevent duplicate entry numbers within same date/tenant

**Why This Is Dangerous:**
The accounting system relies entirely on application-level validation. If there's a bug or the validation is bypassed, the database can accept invalid accounting entries that break fundamental accounting principles.

**Realistic Failure Scenario:**
1. A bug in the invoice creation logic causes debit to not equal credit
2. The journal entry is created with imbalance
3. Financial reports show incorrect totals
4. Balance sheets don't balance
5. The accounting system is corrupted and difficult to fix

**Fix:**
```prisma
model JournalEntry {
  ...
  // ✅ ADD: Unique constraint on (entryNumber, tenantId) to prevent duplicates
  @@unique([entryNumber, tenantId])
}

// ✅ ADD: Database-level check constraint (requires raw SQL)
// ALTER TABLE "JournalEntry" 
// ADD CONSTRAINT "check_entry_balances" 
// CHECK (ABS("totalDebit" - "totalCredit") < 0.01);

// ALTER TABLE "JournalEntry" 
// ADD CONSTRAINT "check_has_lines" 
// CHECK (
//   (SELECT COUNT(*) FROM "JournalEntryLine" WHERE "journalEntryId" = "JournalEntry".id) > 0
// );
```

---

### 9. **CRITICAL: StockTransfer Lacks Validation**

**Location:** `prisma/schema.prisma` lines 694-706

**Issues:**
- No foreign key constraint to ensure `fromWarehouseId` and `toWarehouseId` are different
- No constraint to ensure product exists in source warehouse
- No constraint to ensure sufficient stock in source warehouse
- No constraint to prevent circular transfers (A → B → A)

**Why This Is Dangerous:**
Stock transfers can be created that are logically impossible or that would cause stock inconsistencies.

**Realistic Failure Scenario:**
1. A user creates a stock transfer from Warehouse A to Warehouse A (same warehouse)
2. The system accepts it
3. Stock is decremented and incremented in the same warehouse (net effect: zero, but two transactions created)
4. Inventory becomes confusing and difficult to reconcile

**Fix:**
```prisma
model StockTransfer {
  ...
  // ✅ ADD: Check constraint to prevent same-source transfers (requires raw SQL)
  // ALTER TABLE "StockTransfer" 
  // ADD CONSTRAINT "check_different_warehouses" 
  // CHECK ("fromWarehouseId" != "toWarehouseId");
}
```

Add application-level validation to check:
- Source warehouse exists and belongs to tenant
- Destination warehouse exists and belongs to tenant
- Product has sufficient stock in source warehouse
- Transfer quantity is positive

---

### 10. **CRITICAL: Payment Allocation Lacks Constraints**

**Location:** `prisma/schema.prisma` lines 1415-1430

**Issues:**
- No constraint to prevent over-allocation (allocated amount > payment amount)
- No constraint to prevent duplicate allocations to same invoice
- No foreign key constraint to ensure invoiceId points to valid invoice
- No constraint to ensure allocation amount is positive

**Why This Is Dangerous:**
Payments can be over-allocated, leading to incorrect accounts receivable/payable balances.

**Realistic Failure Scenario:**
1. A payment of $100 is allocated to an invoice for $150
2. The allocation is accepted
3. The invoice shows as overpaid
4. Financial reports show incorrect balances
5. Customer statements are wrong

**Fix:**
```prisma
model PaymentAllocation {
  ...
  // ✅ ADD: Unique constraint to prevent duplicate allocations
  @@unique([paymentId, invoiceId])
}

// ✅ ADD: Check constraints (requires raw SQL or triggers)
// ALTER TABLE "PaymentAllocation" 
// ADD CONSTRAINT "check_positive_amount" 
// CHECK (amount > 0);
```

Add application-level validation to check total allocations don't exceed payment amount.

---

## HIGH PRIORITY ISSUES

### 11. **HIGH: Customer/Supplier Models Lack Credit Limit Enforcement**

**Location:** `prisma/schema.prisma` lines 168-187, 144-163

**Issue:**
```prisma
model Customer {
  creditLimit Float  @default(0)  // ❌ No constraint to enforce
  ...
}
```

**Why This Is Dangerous:**
Credit limits are stored but not enforced at the database level. A bug or bypass could allow customers to exceed credit limits, leading to bad debt.

**Realistic Failure Scenario:**
1. Customer has credit limit of $10,000
2. A bug in the invoice creation logic doesn't check credit limit
3. Customer is allowed to purchase $50,000 on credit
4. Customer defaults on payment
5. Business loses $40,000

**Fix:**
Add application-level validation before creating invoices, and consider a trigger to check credit limit at database level.

---

### 12. **HIGH: No Database-Level Audit Trail**

**Issue:**
While there's an `AuditLog` model, there's no database-level trigger to automatically log changes to critical tables. Critical changes can be made without audit trails.

**Fix:**
Implement PostgreSQL triggers to automatically log changes to critical tables (Product, InventoryTransaction, JournalEntry, etc.).

---

### 13. **HIGH: Product Code Can Be Duplicated Across Tenants**

**Location:** `prisma/schema.prisma` line 194
```prisma
model Product {
  code  String  @unique  // ❌ Global uniqueness - should be per-tenant
  ...
}
```

**Why This Is Dangerous:**
Product codes must be unique within a tenant, but the current constraint makes them globally unique. This prevents tenants from using common product codes like "PROD001".

**Fix:**
```prisma
model Product {
  code     String
  tenantId String
  ...
  @@unique([code, tenantId])  // ✅ Unique per tenant
}
```

---

### 14. **HIGH: No Soft Delete Implementation**

**Issue:**
Critical records (customers, suppliers, products) can be permanently deleted, potentially breaking historical data integrity.

**Fix:**
Implement soft delete pattern with `deletedAt` field and exclude deleted records from queries by default.

---

## PERFORMANCE BOTTLENECKS

### 15. **PERFORMANCE: Missing Composite Indexes for Common Query Patterns**

**Location:** `prisma/schema.prisma`

**Issue:**
Many common query patterns lack composite indexes, leading to full table scans.

**Examples:**
- `InventoryTransaction` queries often filter by `(tenantId, productId, date)` - missing composite index
- `JournalEntry` queries often filter by `(tenantId, entryDate, status)` - missing composite index
- `SalesInvoice` queries often filter by `(tenantId, customerId, status)` - missing composite index

**Fix:**
```prisma
model InventoryTransaction {
  ...
  @@index([tenantId, productId, date])  // ✅ ADD: Common query pattern
  @@index([tenantId, type, date])       // ✅ ADD: Aggregation queries
}

model JournalEntry {
  ...
  @@index([tenantId, entryDate, status])  // ✅ ADD
}

model SalesInvoice {
  ...
  @@index([tenantId, customerId, status])  // ✅ ADD
}
```

---

### 16. **PERFORMANCE: N+1 Query Pattern in Many API Routes**

**Issue:**
Many API routes fetch parent records then loop to fetch child records, causing N+1 queries.

**Fix:**
Use Prisma's `include` or `select` to fetch related data in a single query.

---

## ARCHITECTURAL WEAKNESSES

### 17. **ARCHITECTURE: No Saga Pattern for Distributed Transactions**

**Issue:**
The system uses Prisma transactions for single-database operations, but there's no saga pattern for operations that span multiple services (e.g., invoice creation → stock update → accounting entry → notification).

**Why This Is Dangerous:**
If the accounting service fails after stock is updated, there's no automatic rollback mechanism. The system can end up in an inconsistent state.

**Fix:**
Implement saga pattern with compensating transactions for multi-step operations.

---

### 18. **ARCHITECTURE: No Idempotency Keys for Critical Operations**

**Issue:**
Invoice creation, payment processing, and stock transfers don't use idempotency keys. Retry logic can cause duplicate operations.

**Fix:**
Add idempotency key table and enforce idempotency for all critical operations.

---

### 19. **ARCHITECTURE: No Circuit Breaker for External Dependencies**

**Issue:**
If the payment gateway or email service fails, there's no circuit breaker to prevent cascading failures.

**Fix:**
Implement circuit breaker pattern for external service calls.

---

## SUMMARY

**Critical Issues:** 10 (Production-blocking)  
**High Priority Issues:** 4 (Should fix before production)  
**Performance Issues:** 2 (Affects scalability)  
**Architectural Issues:** 3 (Affects reliability)

**Recommendation:**
1. IMMEDIATELY fix issues #1, #2, #3 (multi-tenant isolation vulnerabilities)
2. BEFORE PRODUCTION: fix issues #4, #5, #6, #7, #8, #9, #10 (data integrity)
3. BEFORE SCALE: fix performance issues #15, #16
4. PLAN FOR: architectural improvements #17, #18, #19

The system has solid foundation but requires hardening around multi-tenant isolation, data integrity constraints, and transaction safety before production deployment.
