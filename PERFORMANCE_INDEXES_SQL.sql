-- ============================================================================
-- PERFORMANCE INDEXES FOR PRODUCTION-GRADE ERP
-- These indexes optimize query performance for high-volume operations
-- ============================================================================

-- ============================================================================
-- 1. MULTI-TENANT QUERIES (Critical for isolation)
// ============================================================================

-- All tables with tenantId should have this index (add if missing)
-- CREATE INDEX CONCURRENTLY "Tenant_tenantId_idx" ON "Tenant"("tenantId");
-- CREATE INDEX CONCURRENTLY "Customer_tenantId_idx" ON "Customer"("tenantId");
-- CREATE INDEX CONCURRENTLY "Supplier_tenantId_idx" ON "Supplier"("tenantId");
-- CREATE INDEX CONCURRENTLY "Product_tenantId_idx" ON "Product"("tenantId");
-- CREATE INDEX CONCURRENTLY "Warehouse_tenantId_idx" ON "Warehouse"("tenantId");
-- CREATE INDEX CONCURRENTLY "SalesInvoice_tenantId_idx" ON "SalesInvoice"("tenantId");
-- CREATE INDEX CONCURRENTLY "PurchaseInvoice_tenantId_idx" ON "PurchaseInvoice"("tenantId");
-- CREATE INDEX CONCURRENTLY "Payment_tenantId_idx" ON "Payment"("tenantId");
-- CREATE INDEX CONCURRENTLY "JournalEntry_tenantId_idx" ON "JournalEntry"("tenantId");
-- CREATE INDEX CONCURRENTLY "InventoryTransaction_tenantId_idx" ON "InventoryTransaction"("tenantId");

-- ============================================================================
-- 2. ACCOUNTING PERFORMANCE INDEXES
// ============================================================================

-- Journal entry queries by date range (common for reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "JournalEntry_tenantId_entryDate_idx" 
  ON "JournalEntry"("tenantId", "entryDate" DESC);

-- Journal entry queries by status (posted vs draft)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "JournalEntry_tenantId_isPosted_idx" 
  ON "JournalEntry"("tenantId", "isPosted");

-- Journal entry queries by reference (for reconciliation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "JournalEntry_tenantId_referenceType_referenceId_idx" 
  ON "JournalEntry"("tenantId", "referenceType", "referenceId");

-- Journal entry line queries by account (for balance calculation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "JournalEntryLine_tenantId_accountCode_idx" 
  ON "JournalEntryLine"("tenantId", "accountCode");

-- Journal entry line queries by account and date (for trial balance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "JournalEntryLine_tenantId_accountCode_createdAt_idx" 
  ON "JournalEntryLine"("tenantId", "accountCode", "createdAt");

-- Account balance history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AccountBalanceHistory_accountCode_changedAt_idx" 
  ON "AccountBalanceHistory"("accountCode", "changedAt" DESC);

-- ============================================================================
-- 3. INVENTORY PERFORMANCE INDEXES
// ============================================================================

-- Product stock queries (for availability checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_tenantId_stock_idx" 
  ON "Product"("tenantId", "stock");

-- Product queries by type and tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_tenantId_type_idx" 
  ON "Product"("tenantId", "type");

-- Product queries by warehouse and tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_tenantId_warehouseId_idx" 
  ON "Product"("tenantId", "warehouseId");

-- Product low stock alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_tenantId_stock_minStock_idx" 
  ON "Product"("tenantId", "stock", "minStock");

-- Inventory transaction queries by product and date (for cost calculation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryTransaction_tenantId_productId_date_idx" 
  ON "InventoryTransaction"("tenantId", "productId", "date" DESC);

-- Inventory transaction queries by type
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryTransaction_tenantId_type_idx" 
  ON "InventoryTransaction"("tenantId", "type");

-- Inventory transaction queries by reference (for reconciliation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryTransaction_tenantId_referenceType_referenceId_idx" 
  ON "InventoryTransaction"("tenantId", "referenceType", "referenceId");

-- Stock transfer queries by warehouse
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockTransfer_tenantId_fromWarehouseId_status_idx" 
  ON "StockTransfer"("tenantId", "fromWarehouseId", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockTransfer_tenantId_toWarehouseId_status_idx" 
  ON "StockTransfer"("tenantId", "toWarehouseId", "status");

-- FIFO layer queries for cost calculation
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FIFOLayer_tenantId_productId_transactionDate_idx" 
  ON "FIFOLayer"("tenantId", "productId", "transactionDate" DESC);

-- ============================================================================
-- 4. SALES PERFORMANCE INDEXES
// ============================================================================

-- Sales invoice queries by customer and date (for customer statements)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalesInvoice_tenantId_customerId_date_idx" 
  ON "SalesInvoice"("tenantId", "customerId", "date" DESC);

-- Sales invoice queries by status (for pending invoices)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalesInvoice_tenantId_status_idx" 
  ON "SalesInvoice"("tenantId", "status");

-- Sales invoice queries by payment status (for aging reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalesInvoice_tenantId_paymentStatus_idx" 
  ON "SalesInvoice"("tenantId", "paymentStatus");

-- Sales invoice item queries by product (for sales analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalesInvoiceItem_salesInvoiceId_productId_idx" 
  ON "SalesInvoiceItem"("salesInvoiceId", "productId");

-- ============================================================================
-- 5. PURCHASING PERFORMANCE INDEXES
// ============================================================================

-- Purchase invoice queries by supplier and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PurchaseInvoice_tenantId_supplierId_date_idx" 
  ON "PurchaseInvoice"("tenantId", "supplierId", "date" DESC);

-- Purchase invoice queries by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PurchaseInvoice_tenantId_status_idx" 
  ON "PurchaseInvoice"("tenantId", "status");

-- Purchase invoice queries by payment status
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PurchaseInvoice_tenantId_paymentStatus_idx" 
  ON "PurchaseInvoice"("tenantId", "paymentStatus");

-- ============================================================================
-- 6. PAYMENT PERFORMANCE INDEXES
// ============================================================================

-- Payment queries by customer
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Payment_tenantId_customerId_date_idx" 
  ON "Payment"("tenantId", "customerId", "date" DESC);

-- Payment queries by supplier
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Payment_tenantId_supplierId_date_idx" 
  ON "Payment"("tenantId", "supplierId", "date" DESC);

-- Payment queries by reconciliation status
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Payment_tenantId_reconciled_idx" 
  ON "Payment"("tenantId", "reconciled");

-- Payment allocation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PaymentAllocation_tenantId_invoiceId_idx" 
  ON "PaymentAllocation"("tenantId", "invoiceId");

-- ============================================================================
// 7. EVENT-DRIVEN ARCHITECTURE INDEXES
// ============================================================================

-- Outbox event queries for processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS "OutboxEvent_tenantId_status_idx" 
  ON "OutboxEvent"("tenantId", "status");

-- Outbox event queries by event type
CREATE INDEX CONCURRENTLY IF NOT EXISTS "OutboxEvent_tenantId_eventType_status_idx" 
  ON "OutboxEvent"("tenantId", "eventType", "status");

-- Outbox event queries by aggregate (for event replay)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "OutboxEvent_tenantId_aggregateId_eventType_idx" 
  ON "OutboxEvent"("tenantId", "aggregateId", "eventType");

-- Outbox event queries by occurredAt (for cleanup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "OutboxEvent_tenantId_occurredAt_idx" 
  ON "OutboxEvent"("tenantId", "occurredAt");

-- Outbox event queries by processedAt (for monitoring)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "OutboxEvent_tenantId_processedAt_idx" 
  ON "OutboxEvent"("tenantId", "processedAt");

-- ============================================================================
// 8. AUDIT AND LOGGING INDEXES
// ============================================================================

-- Audit log queries by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_tenantId_userId_idx" 
  ON "AuditLog"("tenantId", "userId");

-- Audit log queries by action
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_tenantId_action_idx" 
  ON "AuditLog"("tenantId", "action");

-- Audit log queries by module and entity
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_tenantId_module_entityType_idx" 
  ON "AuditLog"("tenantId", "module", "entityType");

-- Audit log queries by date (for audit reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_tenantId_createdAt_idx" 
  ON "AuditLog"("tenantId", "createdAt" DESC);

-- ============================================================================
// 9. STOCK RESERVATION INDEXES
// ============================================================================

-- Stock reservation queries by product
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockReservation_tenantId_productId_status_idx" 
  ON "StockReservation"("tenantId", "productId", "status");

-- Stock reservation queries by reference
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockReservation_tenantId_referenceType_referenceId_idx" 
  ON "StockReservation"("tenantId", "referenceType", "referenceId");

-- ============================================================================
// 10. COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
// ============================================================================

-- Sales invoice: tenant + customer + status + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalesInvoice_tenantId_customerId_status_date_idx" 
  ON "SalesInvoice"("tenantId", "customerId", "status", "date" DESC);

-- Purchase invoice: tenant + supplier + status + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PurchaseInvoice_tenantId_supplierId_status_date_idx" 
  ON "PurchaseInvoice"("tenantId", "supplierId", "status", "date" DESC);

-- Journal entry: tenant + fiscal year + period + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS "JournalEntry_tenantId_fiscalYearId_accountingPeriodId_entryDate_idx" 
  ON "JournalEntry"("tenantId", "fiscalYearId", "accountingPeriodId", "entryDate" DESC);

-- Product: tenant + warehouse + type + stock
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Product_tenantId_warehouseId_type_stock_idx" 
  ON "Product"("tenantId", "warehouseId", "type", "stock");
