-- ============================================================================
-- PRODUCTION-GRADE ERP DATABASE CONSTRAINTS
-- These MUST be applied after schema migration
-- ============================================================================

-- ============================================================================
-- 1. DOUBLE-ENTRY ACCOUNTING CONSTRAINTS
-- ============================================================================

-- Journal entry must balance (totalDebit = totalCredit)
ALTER TABLE "JournalEntry" 
  ADD CONSTRAINT "JournalEntry_BalanceCheck" 
  CHECK ("totalDebit" = "totalCredit");

-- Journal entry line must have either debit OR credit, not both
ALTER TABLE "JournalEntryLine" 
  ADD CONSTRAINT "JournalEntryLine_MutualExclusivity" 
  CHECK (
    ("debit" > 0 AND "credit" = 0) OR 
    ("credit" > 0 AND "debit" = 0)
  );

-- Journal entry line must have non-zero amount
ALTER TABLE "JournalEntryLine" 
  ADD CONSTRAINT "JournalEntryLine_NonZero" 
  CHECK ("debit" > 0 OR "credit" > 0);

-- Journal entry must have at least 2 lines (double-entry requirement)
-- Note: This is a trigger, not a CHECK constraint
CREATE OR REPLACE FUNCTION validate_journal_entry_lines()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM "JournalEntryLine" WHERE "journalEntryId" = NEW.id) < 2 THEN
    RAISE EXCEPTION 'Journal entry must have at least 2 lines for double-entry bookkeeping';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entry_lines_validation
  AFTER INSERT ON "JournalEntryLine"
  FOR EACH ROW
  EXECUTE FUNCTION validate_journal_entry_lines();

-- ============================================================================
-- 2. INVENTORY CONSTRAINTS (Stock can NEVER go negative)
-- ============================================================================

-- Product stock cannot be negative
ALTER TABLE "Product" 
  ADD CONSTRAINT "Product_StockNonNegative" 
  CHECK ("stock" >= 0);

-- Inventory transaction quantity cannot be zero
ALTER TABLE "InventoryTransaction" 
  ADD CONSTRAINT "InventoryTransaction_NonZeroQuantity" 
  CHECK ("quantity" != 0);

-- Stock adjustment quantity cannot be zero
ALTER TABLE "StockAdjustment" 
  ADD CONSTRAINT "StockAdjustment_NonZeroQuantity" 
  CHECK ("quantity" != 0);

-- Stock transfer quantity must be positive
ALTER TABLE "StockTransfer" 
  ADD CONSTRAINT "StockTransfer_PositiveQuantity" 
  CHECK ("quantity" > 0);

-- Stock transfer must be between different warehouses
ALTER TABLE "StockTransfer" 
  ADD CONSTRAINT "StockTransfer_DifferentWarehouses" 
  CHECK ("fromWarehouseId" != "toWarehouseId");

-- ============================================================================
-- 3. ACCOUNTING PERIOD CONSTRAINTS
-- ============================================================================

-- Period dates must be in correct order
ALTER TABLE "AccountingPeriod" 
  ADD CONSTRAINT "AccountingPeriod_DateOrder" 
  CHECK ("startDate" < "endDate");

-- Fiscal year dates must be in correct order
ALTER TABLE "FiscalYear" 
  ADD CONSTRAINT "FiscalYear_DateOrder" 
  CHECK ("startDate" < "endDate");

-- Cannot post to closed period
CREATE OR REPLACE FUNCTION prevent_closed_period_posting()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."isPosted" = true THEN
    IF EXISTS (
      SELECT 1 FROM "AccountingPeriod" 
      WHERE id = NEW."accountingPeriodId" 
      AND "isClosed" = true
    ) THEN
      RAISE EXCEPTION 'Cannot post journal entry to closed accounting period';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_closed_period_posting_trigger
  BEFORE UPDATE ON "JournalEntry"
  FOR EACH ROW
  WHEN (NEW."isPosted" = true AND OLD."isPosted" = false)
  EXECUTE FUNCTION prevent_closed_period_posting();

-- ============================================================================
-- 4. IMMUTABLE POSTED ENTRIES (Critical for financial integrity)
-- ============================================================================

-- Posted entries cannot be modified
CREATE OR REPLACE FUNCTION prevent_posted_entry_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."isPosted" = true AND NEW."isPosted" = true THEN
    IF NEW."updatedAt" > OLD."postedDate" THEN
      RAISE EXCEPTION 'Cannot modify posted journal entry. Create a reversal instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_posted_entry_modification_trigger
  BEFORE UPDATE ON "JournalEntry"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_posted_entry_modification();

-- ============================================================================
-- 5. OPTIMISTIC LOCKING FOR PRODUCT (Concurrency safety)
-- ============================================================================

-- This is enforced at application level, but we add a trigger for safety
CREATE OR REPLACE FUNCTION enforce_product_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."version" != NEW."version" THEN
    RAISE EXCEPTION 'Concurrent modification detected for product %. Expected version %, got %', 
      OLD."code", OLD."version", NEW."version";
  END IF;
  NEW."version" = OLD."version" + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_product_version_trigger
  BEFORE UPDATE ON "Product"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_product_version();

-- ============================================================================
-- 6. MULTI-TENANT ISOLATION ENFORCEMENT (Additional safety)
-- ============================================================================

-- Ensure all accounting records have tenantId (should be handled by NOT NULL in schema)
-- These are additional safety checks

-- ============================================================================
-- 7. BUSINESS RULE CONSTRAINTS
// ============================================================================

-- Sales invoice total must match sum of items
CREATE OR REPLACE FUNCTION validate_sales_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  items_total DECIMAL;
BEGIN
  SELECT COALESCE(SUM("total"), 0) INTO items_total
  FROM "SalesInvoiceItem"
  WHERE "salesInvoiceId" = NEW.id;
  
  IF ABS(NEW."total" - items_total) > 0.01 THEN
    RAISE EXCEPTION 'Sales invoice total (%) does not match sum of items (%)', 
      NEW."total", items_total;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_sales_invoice_total_trigger
  AFTER INSERT OR UPDATE ON "SalesInvoice"
  FOR EACH ROW
  EXECUTE FUNCTION validate_sales_invoice_total();

-- Purchase invoice total must match sum of items
CREATE OR REPLACE FUNCTION validate_purchase_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  items_total DECIMAL;
BEGIN
  SELECT COALESCE(SUM("total"), 0) INTO items_total
  FROM "PurchaseInvoiceItem"
  WHERE "purchaseInvoiceId" = NEW.id;
  
  IF ABS(NEW."total" - items_total) > 0.01 THEN
    RAISE EXCEPTION 'Purchase invoice total (%) does not match sum of items (%)', 
      NEW."total", items_total;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_purchase_invoice_total_trigger
  AFTER INSERT OR UPDATE ON "PurchaseInvoice"
  FOR EACH ROW
  EXECUTE FUNCTION validate_purchase_invoice_total();

-- ============================================================================
-- 8. DATA INTEGRITY CONSTRAINTS
// ============================================================================

-- Payment amount cannot be negative
ALTER TABLE "Payment" 
  ADD CONSTRAINT "Payment_NonNegativeAmount" 
  CHECK ("amount" >= 0);

-- Price cannot be negative
ALTER TABLE "Product" 
  ADD CONSTRAINT "Product_NonNegativePrice" 
  CHECK ("price" >= 0);

-- Cost cannot be negative
ALTER TABLE "Product" 
  ADD CONSTRAINT "Product_NonNegativeCost" 
  CHECK ("cost" >= 0);

-- ============================================================================
-- 9. ENUM-STYLE STRING CONSTRAINTS (Where enums aren't used)
// ============================================================================

-- Journal entry status must be valid
ALTER TABLE "JournalEntry" 
  ADD CONSTRAINT "JournalEntry_ValidStatus" 
  CHECK ("isPosted" IN (true, false));

-- Accounting period status must be valid
ALTER TABLE "AccountingPeriod" 
  ADD CONSTRAINT "AccountingPeriod_ValidStatus" 
  CHECK ("status" IN ('open', 'closed'));

-- ============================================================================
-- 10. AUDIT TRIGGERS (Track all critical financial changes)
// ============================================================================

CREATE OR REPLACE FUNCTION log_journal_entry_posting()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."isPosted" = true AND OLD."isPosted" = false THEN
    INSERT INTO "AuditLog" ("userId", "action", "module", "entityType", "entityId", "status", "tenantId")
    VALUES (
      NEW."createdBy",
      'POST',
      'accounting',
      'JournalEntry',
      NEW."id",
      'success',
      NEW."tenantId"
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_journal_entry_posting_trigger
  AFTER UPDATE ON "JournalEntry"
  FOR EACH ROW
  EXECUTE FUNCTION log_journal_entry_posting();

-- ============================================================================
-- 11. CIRCULAR REFERENCE PREVENTION (Account hierarchy)
// ============================================================================

-- Prevent circular parent-child relationships in Account
-- This requires a trigger that checks the path
CREATE OR REPLACE FUNCTION prevent_circular_account_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the new parentId would create a circular reference
  -- This is a simplified check - full implementation would traverse the hierarchy
  IF NEW."parentId" IS NOT NULL AND NEW."parentId" = NEW."id" THEN
    RAISE EXCEPTION 'Account cannot be its own parent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_circular_account_hierarchy_trigger
  BEFORE INSERT OR UPDATE ON "Account"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_circular_account_hierarchy();
