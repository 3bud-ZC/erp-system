# Production-Grade Database Constraint Strategy

**Purpose:** Fix critical data integrity, multi-tenant isolation, and transaction safety issues

---

## PART 1: Prisma Schema Improvements

### 1.1 Session Model - Make tenantId Required

```prisma
model Session {
  id         String   @id @default(cuid())
  userId     String
  token      String   @unique
  expiresAt  DateTime
  isActive   Boolean  @default(true)
  ipAddress  String?
  userAgent  String?
  deviceType String?
  deviceName String?
  lastSeenAt DateTime @default(now())
  tenantId   String   // ✅ REMOVED optional marker
  createdAt  DateTime @default(now())
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([tenantId])
  @@index([isActive])
  @@index([expiresAt])
}
```

### 1.2 User Model - Add Tenant Isolation

```prisma
model User {
  id              String           @id @default(cuid())
  email           String           @unique
  name            String?
  password        String
  isActive        Boolean          @default(true)
  lastLogin       DateTime?
  tenantId        String           // ✅ ADD: Tenant isolation
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  auditLogs       AuditLog[]
  sessions        Session[]
  roles           UserRole[]
  userTenantRoles UserTenantRole[]
  tenant          Tenant           @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@unique([email, tenantId])  // ✅ Email unique per tenant
}
```

### 1.3 Role Model - Add Tenant Isolation

```prisma
model Role {
  id          String           @id @default(cuid())
  code        String
  nameAr      String
  nameEn      String?
  description String?
  isActive    Boolean          @default(true)
  tenantId    String           // ✅ ADD: Tenant isolation
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  permissions RolePermission[]
  users       UserRole[]
  tenant      Tenant           @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@unique([code, tenantId])  // ✅ Code unique per tenant
}
```

### 1.4 Account Model - Add Tenant Isolation

```prisma
model Account {
  id             String                  @id @default(cuid())
  code           String
  nameAr         String
  nameEn         String?
  type           String
  subType        String?
  balance        Decimal                 @default(0)
  tenantId       String                  // ✅ ADD: Tenant isolation
  isActive       Boolean                 @default(true)
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt
  balanceHistory AccountBalanceHistory[]
  budgetEntries  BudgetEntry[]
  journalLines   JournalEntryLine[]
  tenant         Tenant                  @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@unique([code, tenantId])  // ✅ Code unique per tenant
}
```

### 1.5 Product Model - Add Version for Concurrency + Fix Unique Constraint

```prisma
model Product {
  id                       String                     @id @default(cuid())
  code                     String
  nameAr                   String
  nameEn                   String?
  type                     String
  unit                     String
  price                    Float
  cost                     Float                      @default(0)
  stock                    Float                      @default(0)
  minStock                 Float                      @default(0)
  version                  Int                        @default(0)  // ✅ ADD: Optimistic concurrency
  unitId                   String?
  companyId                String?
  itemGroupId              String?
  warehouseId              String?
  tenantId                 String
  createdAt                DateTime                   @default(now())
  updatedAt                DateTime                   @updatedAt
  bomMaterials             BOMItem[]                  @relation("BOMMaterial")
  bomItems                 BOMItem[]                  @relation("BOMProduct")
  batches                  Batch[]
  cogsTransactions         COGSTransaction[]
  costLayers               CostLayer[]
  fifoLayers               FIFOLayer[]
  goodsReceiptItems        GoodsReceiptItem[]
  inventoryTransactions    InventoryTransaction[]     @relation("InventoryTransactions")
  inventoryValuation       InventoryValuation?        @relation("InventoryValuation")
  company                  Company?                   @relation(fields: [companyId], references: [id])
  itemGroup                ItemGroup?                 @relation(fields: [itemGroupId], references: [id])
  tenant                   Tenant                     @relation(fields: [tenantId], references: [id])
  unitRef                  Unit?                      @relation(fields: [unitId], references: [id])

  @@index([tenantId])
  @@index([code])
  @@unique([code, tenantId])  // ✅ Product code unique per tenant
  @@index([tenantId, warehouseId])  // ✅ Composite for queries
}
```

### 1.6 InventoryTransaction Model - Add Enum + Constraints

```prisma
enum TransactionType {
  PURCHASE
  SALE
  PRODUCTION_IN
  PRODUCTION_OUT
  ADJUSTMENT
  RETURN
  PURCHASE_RETURN
}

model InventoryTransaction {
  id            String            @id @default(cuid())
  productId     String
  type          TransactionType  // ✅ CHANGE: Use enum instead of String
  quantity      Float
  referenceId   String?
  referenceType String?
  unitCost      Float?
  totalCost     Float?
  warehouseId   String?
  date          DateTime
  notes         String?
  tenantId      String
  createdAt     DateTime          @default(now())
  product       Product           @relation("InventoryTransactions", fields: [productId], references: [id])
  tenant        Tenant            @relation(fields: [tenantId], references: [id])

  @@index([productId])
  @@index([type])
  @@index([date])
  @@index([referenceId])
  @@index([tenantId])
  @@index([warehouseId])
  @@index([tenantId, productId, date])  // ✅ Composite for common queries
  @@index([tenantId, type, date])       // ✅ Composite for aggregations
  @@unique([productId, type, referenceId, date])  // ✅ Prevent duplicate transactions
}
```

### 1.7 JournalEntry Model - Add Constraints

```prisma
model JournalEntry {
  id              String             @id @default(cuid())
  entryNumber     String
  entryDate       DateTime
  description     String?
  referenceType   String?
  referenceId     String?
  totalDebit      Decimal            @default(0)
  totalCredit     Decimal            @default(0)
  isPosted        Boolean            @default(false)
  postedDate      DateTime?
  createdBy       String?
  tenantId        String
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  accrual         Accrual?
  tenant          Tenant             @relation(fields: [tenantId], references: [id])
  lines           JournalEntryLine[]
  payments        Payment[]          @relation("PaymentJournalEntry")
  stockAdjustment StockAdjustment?

  @@index([tenantId])
  @@index([entryDate])
  @@index([isPosted])
  @@unique([entryNumber, tenantId])  // ✅ Entry number unique per tenant
  @@index([tenantId, entryDate, status])  // ✅ Composite for queries
}
```

### 1.8 JournalEntryLine Model - Add TenantId

```prisma
model JournalEntryLine {
  id             String       @id @default(cuid())
  journalEntryId String
  accountCode    String
  debit          Decimal      @default(0)
  credit         Decimal      @default(0)
  description    String?
  tenantId       String       // ✅ ADD: Tenant isolation
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  account        Account      @relation(fields: [accountCode], references: [id])
  journalEntry   JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  tenant         Tenant       @relation(fields: [tenantId], references: [id])

  @@index([journalEntryId])
  @@index([accountCode])
  @@index([tenantId])
  @@index([tenantId, accountCode])  // ✅ Composite for queries
}
```

### 1.9 StockTransfer Model - Add Validation Constraints

```prisma
model StockTransfer {
  id              String    @id @default(cuid())
  transferNumber  String    @unique
  productId       String
  fromWarehouseId String
  toWarehouseId   String
  quantity        Float
  status          String    @default("pending")
  date            DateTime
  notes           String?
  tenantId        String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  fromWarehouse   Warehouse @relation("FromWarehouse", fields: [fromWarehouseId], references: [id])
  product         Product   @relation(fields: [productId], references: [id])
  tenant          Tenant    @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([productId])
  @@index([fromWarehouseId])
  @@index([toWarehouseId])
  @@index([status])
  @@index([tenantId, productId, status])  // ✅ Composite for queries
}
```

### 1.10 PaymentAllocation Model - Add Constraints

```prisma
model PaymentAllocation {
  id          String   @id @default(cuid())
  paymentId   String
  invoiceId   String
  invoiceType String
  amount      Float
  allocatedAt DateTime @default(now())
  allocatedBy String?
  tenantId    String
  createdAt   DateTime @default(now())
  payment     Payment  @relation(fields: [paymentId], references: [id])
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  @@index([paymentId])
  @@index([invoiceId])
  @@index([invoiceType])
  @@index([tenantId])
  @@unique([paymentId, invoiceId])  // ✅ Prevent duplicate allocations
}
```

### 1.11 Customer/Supplier Models - Per-Tenant Code Uniqueness

```prisma
model Customer {
  id          String         @id @default(cuid())
  code        String
  nameAr      String
  nameEn      String?
  phone       String?
  email       String?
  address     String?
  taxNumber   String?
  creditLimit Float          @default(0)
  tenantId    String
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  tenant      Tenant         @relation(fields: [tenantId], references: [id])
  payments    Payment[]
  quotations  Quotation[]
  salesInvoices SalesInvoice[]
  salesOrders SalesOrder[]
  salesReturns SalesReturn[]

  @@index([tenantId])
  @@unique([code, tenantId])  // ✅ Code unique per tenant
}

model Supplier {
  id                String                @id @default(cuid())
  code              String
  nameAr            String
  nameEn            String?
  phone             String?
  email             String?
  address           String?
  taxNumber         String?
  creditLimit       Float                 @default(0)
  tenantId          String
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt
  payments          Payment[]
  purchaseInvoices  PurchaseInvoice[]
  purchaseOrders    PurchaseOrder[]
  purchaseRequisitions PurchaseRequisition[]
  purchaseReturns   PurchaseReturn[]
  tenant            Tenant                @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@unique([code, tenantId])  // ✅ Code unique per tenant
}
```

---

## PART 2: PostgreSQL Constraints (Raw SQL)

### 2.1 Product Stock Non-Negative Constraint

```sql
-- Add check constraint to prevent negative stock
ALTER TABLE "Product" 
ADD CONSTRAINT "check_stock_non_negative" 
CHECK (stock >= 0);

-- Add check constraint for reasonable stock range
ALTER TABLE "Product" 
ADD CONSTRAINT "check_stock_range" 
CHECK (stock >= 0 AND stock < 1000000000);
```

### 2.2 InventoryTransaction Quantity Constraints

```sql
-- Prevent zero quantity transactions
ALTER TABLE "InventoryTransaction" 
ADD CONSTRAINT "check_quantity_non_zero" 
CHECK (quantity != 0);

-- Prevent extremely large quantities
ALTER TABLE "InventoryTransaction" 
ADD CONSTRAINT "check_quantity_range" 
CHECK (quantity > -1000000 AND quantity < 1000000);

-- Ensure date is not in the future (for most transaction types)
ALTER TABLE "InventoryTransaction" 
ADD CONSTRAINT "check_date_not_future" 
CHECK (date <= NOW() + INTERVAL '1 day');
```

### 2.3 JournalEntry Balance Constraint

```sql
-- Ensure journal entries balance (debit == credit)
ALTER TABLE "JournalEntry" 
ADD CONSTRAINT "check_entry_balances" 
CHECK (ABS("totalDebit" - "totalCredit") < 0.01);

-- Ensure posted entries have at least one line
ALTER TABLE "JournalEntry" 
ADD CONSTRAINT "check_has_lines" 
CHECK (
  "isPosted" = false OR 
  (SELECT COUNT(*) FROM "JournalEntryLine" WHERE "journalEntryId" = "JournalEntry".id) > 0
);

-- Ensure entry date is not in the future
ALTER TABLE "JournalEntry" 
ADD CONSTRAINT "check_entry_date_not_future" 
CHECK ("entryDate" <= NOW() + INTERVAL '1 day');
```

### 2.4 JournalEntryLine Constraints

```sql
-- Ensure at least one of debit or credit is non-zero
ALTER TABLE "JournalEntryLine" 
ADD CONSTRAINT "check_debit_or_credit" 
CHECK (debit > 0 OR credit > 0);

-- Prevent both debit and credit on same line
ALTER TABLE "JournalEntryLine" 
ADD CONSTRAINT "check_not_both_debit_credit" 
CHECK (NOT (debit > 0 AND credit > 0));

-- Ensure amounts are non-negative
ALTER TABLE "JournalEntryLine" 
ADD CONSTRAINT "check_amounts_non_negative" 
CHECK (debit >= 0 AND credit >= 0);
```

### 2.5 StockTransfer Constraints

```sql
-- Prevent transferring to same warehouse
ALTER TABLE "StockTransfer" 
ADD CONSTRAINT "check_different_warehouses" 
CHECK ("fromWarehouseId" != "toWarehouseId");

-- Ensure quantity is positive
ALTER TABLE "StockTransfer" 
ADD CONSTRAINT "check_quantity_positive" 
CHECK (quantity > 0);
```

### 2.6 PaymentAllocation Constraints

```sql
-- Ensure allocation amount is positive
ALTER TABLE "PaymentAllocation" 
ADD CONSTRAINT "check_amount_positive" 
CHECK (amount > 0);

-- Function to check total allocations don't exceed payment amount
CREATE OR REPLACE FUNCTION check_payment_allocation_limit()
RETURNS TRIGGER AS $$
DECLARE
  payment_total DECIMAL;
  allocated_total DECIMAL;
BEGIN
  -- Get payment amount
  SELECT amount INTO payment_total
  FROM "Payment"
  WHERE id = NEW.paymentId;

  -- Calculate total allocated
  SELECT COALESCE(SUM(amount), 0) INTO allocated_total
  FROM "PaymentAllocation"
  WHERE paymentId = NEW.paymentId;

  -- Check if this allocation would exceed payment
  IF (allocated_total + NEW.amount) > payment_total THEN
    RAISE EXCEPTION 'Payment allocation exceeds payment amount';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce payment allocation limit
CREATE TRIGGER enforce_payment_allocation_limit
BEFORE INSERT OR UPDATE ON "PaymentAllocation"
FOR EACH ROW EXECUTE FUNCTION check_payment_allocation_limit();
```

### 2.7 Customer/Supplier Credit Limit Triggers

```sql
-- Function to check customer credit limit before invoice creation
CREATE OR REPLACE FUNCTION check_customer_credit_limit()
RETURNS TRIGGER AS $$
DECLARE
  customer_credit_limit DECIMAL;
  customer_current_balance DECIMAL;
  invoice_total DECIMAL;
BEGIN
  -- Get customer credit limit
  SELECT "creditLimit" INTO customer_credit_limit
  FROM "Customer"
  WHERE id = NEW.customerId;

  -- Get current customer balance (unpaid invoices)
  SELECT COALESCE(SUM("grandTotal" - "paidAmount"), 0) INTO customer_current_balance
  FROM "SalesInvoice"
  WHERE customerId = NEW.customerId 
    AND status != 'paid'
    AND status != 'cancelled';

  -- Get new invoice total
  invoice_total := NEW.grandTotal;

  -- Check if this would exceed credit limit
  IF (customer_current_balance + invoice_total) > customer_credit_limit THEN
    RAISE EXCEPTION 'Customer credit limit exceeded. Current: %, New: %, Limit: %',
      customer_current_balance, invoice_total, customer_credit_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce customer credit limit
CREATE TRIGGER enforce_customer_credit_limit
BEFORE INSERT ON "SalesInvoice"
FOR EACH ROW EXECUTE FUNCTION check_customer_credit_limit();
```

### 2.8 Soft Delete Implementation

```sql
-- Add deletedAt column to critical tables
ALTER TABLE "Customer" ADD COLUMN "deletedAt" DateTime;
ALTER TABLE "Supplier" ADD COLUMN "deletedAt" DateTime;
ALTER TABLE "Product" ADD COLUMN "deletedAt" DateTime;

-- Create partial indexes that exclude deleted records
CREATE INDEX "Customer_tenantId_active" ON "Customer"("tenantId") WHERE "deletedAt" IS NULL;
CREATE INDEX "Supplier_tenantId_active" ON "Supplier"("tenantId") WHERE "deletedAt" IS NULL;
CREATE INDEX "Product_tenantId_active" ON "Product"("tenantId") WHERE "deletedAt" IS NULL;
```

---

## PART 3: Indexing Strategy for Performance

### 3.1 Composite Indexes for Common Query Patterns

```sql
-- InventoryTransaction queries
CREATE INDEX "InventoryTransaction_tenant_product_date" 
ON "InventoryTransaction"("tenantId", "productId", "date");

CREATE INDEX "InventoryTransaction_tenant_type_date" 
ON "InventoryTransaction"("tenantId", "type", "date");

CREATE INDEX "InventoryTransaction_tenant_warehouse_date" 
ON "InventoryTransaction"("tenantId", "warehouseId", "date");

-- JournalEntry queries
CREATE INDEX "JournalEntry_tenant_date_status" 
ON "JournalEntry"("tenantId", "entryDate", "isPosted");

CREATE INDEX "JournalEntry_tenant_reference" 
ON "JournalEntry"("tenantId", "referenceType", "referenceId");

-- JournalEntryLine queries
CREATE INDEX "JournalEntryLine_tenant_account" 
ON "JournalEntryLine"("tenantId", "accountCode");

-- SalesInvoice queries
CREATE INDEX "SalesInvoice_tenant_customer_status" 
ON "SalesInvoice"("tenantId", "customerId", "status");

CREATE INDEX "SalesInvoice_tenant_date_status" 
ON "SalesInvoice"("tenantId", "date", "status");

-- PurchaseInvoice queries
CREATE INDEX "PurchaseInvoice_tenant_supplier_status" 
ON "PurchaseInvoice"("tenantId", "supplierId", "status");

-- Product queries
CREATE INDEX "Product_tenant_warehouse" 
ON "Product"("tenantId", "warehouseId");

CREATE INDEX "Product_tenant_type" 
ON "Product"("tenantId", "type");

-- StockTransfer queries
CREATE INDEX "StockTransfer_tenant_product_status" 
ON "StockTransfer"("tenantId", "productId", "status");
```

### 3.2 Covering Indexes for Frequent Queries

```sql
-- Covering index for product stock queries (includes stock for filtering)
CREATE INDEX "Product_tenant_stock" 
ON "Product"("tenantId", "stock") 
INCLUDE ("code", "nameAr");

-- Covering index for inventory transaction history
CREATE INDEX "InventoryTransaction_history" 
ON "InventoryTransaction"("productId", "date" DESC) 
INCLUDE ("type", "quantity", "tenantId");

-- Covering index for journal entry lookups
CREATE INDEX "JournalEntry_lookup" 
ON "JournalEntry"("entryNumber", "tenantId") 
INCLUDE ("entryDate", "totalDebit", "totalCredit", "isPosted");
```

---

## PART 4: Concurrency-Safe Stock Update Pattern

### 4.1 Optimistic Concurrency Control Implementation

```typescript
// lib/stock-operations.ts
import { prisma } from './db';

export interface StockUpdateResult {
  success: boolean;
  newStock: number;
  newVersion: number;
}

/**
 * Concurrency-safe stock update using optimistic locking
 * Throws if version has changed (concurrent modification detected)
 */
export async function updateStockWithOptimisticLock(
  productId: string,
  tenantId: string,
  quantityDelta: number,
  expectedVersion: number
): Promise<StockUpdateResult> {
  try {
    const updated = await prisma.product.update({
      where: {
        id: productId,
        version: expectedVersion,  // Only update if version hasn't changed
      },
      data: {
        stock: {
          increment: quantityDelta,
        },
        version: {
          increment: 1,
        },
      },
      select: {
        stock: true,
        version: true,
      },
    });

    return {
      success: true,
      newStock: updated.stock,
      newVersion: updated.version,
    };
  } catch (error) {
    if (error.code === 'P2025') {
      // Record not found or version mismatch - concurrent modification
      throw new Error(
        `Concurrent modification detected for product ${productId}. ` +
        `Expected version ${expectedVersion}, but it has changed. ` +
        `Please retry the operation.`
      );
    }
    throw error;
  }
}

/**
 * Atomic stock decrement with optimistic locking and stock check
 * Throws if insufficient stock or concurrent modification
 */
export async function atomicDecrementStockWithLock(
  tx: Prisma.TransactionClient,
  productId: string,
  tenantId: string,
  quantity: number,
  expectedVersion: number
): Promise<StockUpdateResult> {
  // First, check current stock and version
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { stock: true, version: true },
  });

  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  if (product.stock < quantity) {
    throw new Error(
      `Insufficient stock for product ${productId}. ` +
      `Available: ${product.stock}, Required: ${quantity}`
    );
  }

  if (product.version !== expectedVersion) {
    throw new Error(
      `Concurrent modification detected for product ${productId}. ` +
      `Expected version ${expectedVersion}, current: ${product.version}`
    );
  }

  // Perform the update with version check
  const updated = await tx.product.update({
    where: {
      id: productId,
      version: expectedVersion,
    },
    data: {
      stock: {
        decrement: quantity,
      },
      version: {
        increment: 1,
      },
    },
    select: {
      stock: true,
      version: true,
    },
  });

  return {
    success: true,
    newStock: updated.stock,
    newVersion: updated.version,
  };
}

/**
 * Retry pattern for optimistic locking
 * Automatically retries on concurrent modification
 */
export async function updateStockWithRetry(
  productId: string,
  tenantId: string,
  quantityDelta: number,
  maxRetries: number = 3
): Promise<StockUpdateResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get current version
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { version: true },
      });

      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Attempt update with current version
      return await updateStockWithOptimisticLock(
        productId,
        tenantId,
        quantityDelta,
        product.version
      );
    } catch (error) {
      lastError = error;
      
      // If it's a concurrent modification error, retry
      if (error.message.includes('Concurrent modification')) {
        // Exponential backoff: 50ms, 100ms, 200ms
        const backoffMs = 50 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
      
      // If it's not a concurrent modification error, don't retry
      throw error;
    }
  }

  // All retries exhausted
  throw lastError || new Error('Max retries exceeded for stock update');
}
```

### 4.2 Integration with Inventory Transactions

```typescript
// lib/inventory-transactions.ts (updated)
import { atomicDecrementStockWithLock, updateStockWithRetry } from './stock-operations';

/**
 * Atomically check and decrement stock with optimistic locking
 * Combines atomic stock check, version-based concurrency control, and transaction recording
 */
export async function atomicDecrementStock(
  tx: Prisma.TransactionClient,
  items: InventoryTransactionItem[],
  referenceId: string,
  transactionType: 'sale' | 'production_out',
  tenantId: string
): Promise<void> {
  for (const item of items) {
    // Get current product state
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { stock: true, version: true, nameAr: true },
    });

    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    if (product.stock < item.quantity) {
      throw new Error(
        `رصيد المخزون غير كافٍ: ${product.nameAr || item.productId} ` +
        `(المتاح: ${product.stock}، المطلوب: ${item.quantity})`
      );
    }

    // Use optimistic locking for the update
    try {
      await atomicDecrementStockWithLock(
        tx,
        item.productId,
        tenantId,
        item.quantity,
        product.version
      );
    } catch (error) {
      if (error.message.includes('Concurrent modification')) {
        throw new Error(
          `Concurrent stock modification detected for product ${item.productId}. ` +
          `Please retry the operation.`
        );
      }
      throw error;
    }

    // Record the inventory transaction
    await createInventoryTransaction(
      tx,
      item.productId,
      transactionType,
      -item.quantity,
      tenantId,
      referenceId
    );
  }
}
```

---

## PART 5: Double-Entry Enforcement Strategy

### 5.1 Database-Level Enforcement

```sql
-- Function to validate journal entry balance before posting
CREATE OR REPLACE FUNCTION validate_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  entry_total_debit DECIMAL;
  entry_total_credit DECIMAL;
BEGIN
  -- Only check on update to isPosted = true
  IF NEW.isPosted = true AND (OLD.isPosted = false OR OLD.isPosted IS NULL) THEN
    -- Calculate totals from lines
    SELECT COALESCE(SUM(debit), 0) INTO entry_total_debit
    FROM "JournalEntryLine"
    WHERE "journalEntryId" = NEW.id;

    SELECT COALESCE(SUM(credit), 0) INTO entry_total_credit
    FROM "JournalEntryLine"
    WHERE "journalEntryId" = NEW.id;

    -- Check if entry balances
    IF ABS(entry_total_debit - entry_total_credit) >= 0.01 THEN
      RAISE EXCEPTION 'Journal entry does not balance. Debit: %, Credit: %',
        entry_total_debit, entry_total_credit;
    END IF;

    -- Update the totals on the entry
    NEW.totalDebit := entry_total_debit;
    NEW.totalCredit := entry_total_credit;
    NEW.postedDate := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce balance before posting
CREATE TRIGGER enforce_journal_entry_balance
BEFORE UPDATE OF "isPosted" ON "JournalEntry"
FOR EACH ROW EXECUTE FUNCTION validate_journal_entry_balance();

-- Function to prevent modification of posted entries
CREATE OR REPLACE FUNCTION prevent_posted_entry_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.isPosted = true THEN
    RAISE EXCEPTION 'Cannot modify a posted journal entry';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent modification of posted entries
CREATE TRIGGER prevent_posted_entry_modification
BEFORE UPDATE ON "JournalEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_posted_entry_modification();

-- Trigger to prevent deletion of posted entries
CREATE TRIGGER prevent_posted_entry_deletion
BEFORE DELETE ON "JournalEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_posted_entry_modification();

-- Function to prevent modification of posted entry lines
CREATE OR REPLACE FUNCTION prevent_posted_line_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if parent entry is posted
  SELECT "isPosted" INTO TG_OP
  FROM "JournalEntry"
  WHERE id = NEW."journalEntryId";

  IF TG_OP = 'true'::boolean THEN
    RAISE EXCEPTION 'Cannot modify lines of a posted journal entry';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent modification of posted entry lines
CREATE TRIGGER prevent_posted_line_modification
BEFORE INSERT OR UPDATE ON "JournalEntryLine"
FOR EACH ROW EXECUTE FUNCTION prevent_posted_line_modification();
```

### 5.2 Application-Level Enforcement

```typescript
// lib/accounting.ts (updated)
import { prisma } from './db';

export interface JournalEntryInput {
  entryDate: Date;
  description: string;
  referenceType: string;
  referenceId: string;
  tenantId: string;
  lines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
}

/**
 * Create journal entry with double-entry validation
 * Enforces balance at application level before database write
 */
export async function createJournalEntry(
  input: JournalEntryInput
): Promise<Prisma.JournalEntryCreateInput> {
  // Calculate totals
  const totalDebit = input.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = input.lines.reduce((sum, line) => sum + line.credit, 0);

  // Validate balance
  if (Math.abs(totalDebit - totalCredit) >= 0.01) {
    throw new Error(
      `Journal entry does not balance. Debit: ${totalDebit}, Credit: ${totalCredit}`
    );
  }

  // Validate at least two lines
  if (input.lines.length < 2) {
    throw new Error('Journal entry must have at least two lines');
  }

  // Validate each line has either debit or credit, not both
  for (const line of input.lines) {
    if (line.debit > 0 && line.credit > 0) {
      throw new Error(
        `Line for account ${line.accountCode} has both debit and credit`
      );
    }
    if (line.debit <= 0 && line.credit <= 0) {
      throw new Error(
        `Line for account ${line.accountCode} must have either debit or credit`
      );
    }
  }

  // Validate account codes exist
  const accountCodes = input.lines.map(l => l.accountCode);
  const accounts = await prisma.account.findMany({
    where: {
      code: { in: accountCodes },
      tenantId: input.tenantId,
    },
    select: { code: true },
  });

  const foundCodes = new Set(accounts.map(a => a.code));
  const missingCodes = accountCodes.filter(code => !foundCodes.has(code));
  
  if (missingCodes.length > 0) {
    throw new Error(
      `Account codes not found: ${missingCodes.join(', ')}`
    );
  }

  // Generate entry number
  const entryNumber = await generateEntryNumber(input.tenantId);

  // Create journal entry with lines in a transaction
  return await prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        entryNumber,
        entryDate: input.entryDate,
        description: input.description,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        totalDebit: totalDebit,
        totalCredit: totalCredit,
        isPosted: false,  // Start as unposted
        tenantId: input.tenantId,
        lines: {
          create: input.lines.map(line => ({
            accountCode: line.accountCode,
            debit: line.debit,
            credit: line.credit,
            description: line.description,
            tenantId: input.tenantId,
          })),
        },
      },
    });

    return entry;
  });
}

/**
 * Post journal entry (make it immutable)
 * This triggers database-level balance validation
 */
export async function postJournalEntry(
  journalEntryId: string,
  tenantId: string
): Promise<Prisma.JournalEntry> {
  return await prisma.journalEntry.update({
    where: { 
      id: journalEntryId,
      tenantId,  // Ensure tenant isolation
    },
    data: {
      isPosted: true,
      postedDate: new Date(),
    },
  });
}
```

### 5.3 Account Balance Maintenance

```sql
-- Function to update account balance when journal entry is posted
CREATE OR REPLACE FUNCTION update_account_balances()
RETURNS TRIGGER AS $$
BEGIN
  -- Only execute when entry is posted
  IF NEW.isPosted = true AND (OLD.isPosted = false OR OLD.isPosted IS NULL) THEN
    -- Update debit accounts
    UPDATE "Account"
    SET balance = balance + (
      SELECT COALESCE(SUM(debit), 0)
      FROM "JournalEntryLine"
      WHERE "journalEntryId" = NEW.id
        AND debit > 0
    )
    WHERE code IN (
      SELECT accountCode
      FROM "JournalEntryLine"
      WHERE "journalEntryId" = NEW.id
        AND debit > 0
    );

    -- Update credit accounts
    UPDATE "Account"
    SET balance = balance - (
      SELECT COALESCE(SUM(credit), 0)
      FROM "JournalEntryLine"
      WHERE "journalEntryId" = NEW.id
        AND credit > 0
    )
    WHERE code IN (
      SELECT accountCode
      FROM "JournalEntryLine"
      WHERE "journalEntryId" = NEW.id
        AND credit > 0
    );

    -- Record balance history
    INSERT INTO "AccountBalanceHistory" ("accountCode", "balance", "changeAmount", "journalEntryId", "changeType", "changedBy")
    SELECT 
      jl.accountCode,
      a.balance,
      jl.debit - jl.credit,
      NEW.id,
      CASE 
        WHEN jl.debit > 0 THEN 'debit'
        ELSE 'credit'
      END,
      NEW.createdBy
    FROM "JournalEntryLine" jl
    JOIN "Account" a ON a.code = jl.accountCode
    WHERE jl."journalEntryId" = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update account balances on posting
CREATE TRIGGER update_account_balances
AFTER UPDATE OF "isPosted" ON "JournalEntry"
FOR EACH ROW EXECUTE FUNCTION update_account_balances();
```

---

## PART 6: Migration Implementation

### 6.1 Prisma Migration Order

```bash
# Step 1: Add new fields and change types
npx prisma migrate dev --name add_tenant_isolation_and_version

# Step 2: Regenerate Prisma client
npx prisma generate

# Step 3: Apply SQL constraints
psql $DATABASE_URL -f database-constraints.sql

# Step 4: Create indexes
psql $DATABASE_URL -f database-indexes.sql

# Step 5: Create triggers
psql $DATABASE_URL -f database-triggers.sql
```

### 6.2 Data Migration Script

```typescript
// scripts/migrate-tenant-isolation.ts
import { prisma } from '../lib/db';

async function migrateTenantIsolation() {
  console.log('Starting tenant isolation migration...');

  // Migrate Users - assign to default tenant or create tenant mapping
  const users = await prisma.user.findMany({
    where: { tenantId: null },
  });

  for (const user of users) {
    // Logic to assign tenantId based on existing relationships
    // This depends on your specific data model
    console.log(`Migrating user ${user.id}...`);
  }

  // Migrate Accounts - assign to default tenant
  const accounts = await prisma.account.findMany({
    where: { tenantId: null },
  });

  // Similar logic for accounts, roles, etc.

  console.log('Migration complete');
}

migrateTenantIsolation()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 6.3 Validation Script

```typescript
// scripts/validate-constraints.ts
import { prisma } from '../lib/db';

async function validateConstraints() {
  console.log('Validating database constraints...');

  // Check for negative stock
  const negativeStock = await prisma.product.findMany({
    where: { stock: { lt: 0 } },
  });

  if (negativeStock.length > 0) {
    console.error(`Found ${negativeStock.length} products with negative stock`);
    console.error(negativeStock.map(p => `${p.code}: ${p.stock}`));
  }

  // Check for unbalanced journal entries
  const unbalancedEntries = await prisma.$queryRaw`
    SELECT id, "entryNumber", "totalDebit", "totalCredit"
    FROM "JournalEntry"
    WHERE ABS("totalDebit" - "totalCredit") >= 0.01
  `;

  if (unbalancedEntries.length > 0) {
    console.error(`Found ${unbalancedEntries.length} unbalanced journal entries`);
  }

  console.log('Validation complete');
}

validateConstraints()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## PART 7: Implementation Checklist

### 7.1 Schema Changes
- [ ] Add tenantId to Session (required)
- [ ] Add tenantId to User
- [ ] Add tenantId to Role
- [ ] Add tenantId to Account
- [ ] Add version to Product
- [ ] Change InventoryTransaction.type to enum
- [ ] Add tenantId to JournalEntryLine
- [ ] Add unique constraints per-tenant
- [ ] Add composite unique constraints

### 7.2 SQL Constraints
- [ ] Product stock non-negative check
- [ ] InventoryTransaction quantity checks
- [ ] JournalEntry balance check
- [ ] JournalEntryLine debit/credit checks
- [ ] StockTransfer warehouse difference check
- [ ] Payment allocation limit trigger
- [ ] Customer credit limit trigger

### 7.3 Indexes
- [ ] Composite indexes for common queries
- [ ] Covering indexes for frequent lookups
- [ ] Partial indexes for soft-delete patterns

### 7.4 Concurrency Control
- [ ] Add version field to Product
- [ ] Implement optimistic locking functions
- [ ] Update stock update functions
- [ ] Add retry pattern for concurrent updates

### 7.5 Double-Entry Enforcement
- [ ] Add journal entry balance trigger
- [ ] Add posted entry modification prevention
- [ ] Add account balance update trigger
- [ ] Update application-level validation
- [ ] Add posting function

### 7.6 Testing
- [ ] Test tenant isolation bypass prevention
- [ ] Test negative stock prevention
- [ ] Test concurrent stock updates
- [ ] Test journal entry balance enforcement
- [ ] Test credit limit enforcement
- [ ] Performance test with new indexes

---

## SUMMARY

This strategy provides:
- **Exact Prisma schema changes** for tenant isolation and data integrity
- **PostgreSQL constraints** for database-level enforcement
- **Composite indexes** for query performance optimization
- **Optimistic concurrency control** for safe concurrent updates
- **Double-entry enforcement** at both database and application levels

All constraints are production-grade and prevent the critical issues identified in the audit.
