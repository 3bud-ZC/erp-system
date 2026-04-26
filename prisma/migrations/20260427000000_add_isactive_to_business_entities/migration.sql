-- Add `isActive` flag to Customer / Supplier / Product / Warehouse so we
-- can support a "smart delete" workflow:
--   - if no related rows exist  → hard delete the row
--   - if related rows exist     → soft delete (set isActive = false)
--
-- All four columns default to TRUE so existing rows remain active. Forward
-- only — no data is dropped or rewritten.

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "Warehouse"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;

-- Helpful indexes for the common "list active rows" query path.
CREATE INDEX IF NOT EXISTS "Customer_isActive_idx"  ON "Customer"("isActive");
CREATE INDEX IF NOT EXISTS "Supplier_isActive_idx"  ON "Supplier"("isActive");
CREATE INDEX IF NOT EXISTS "Product_isActive_idx"   ON "Product"("isActive");
CREATE INDEX IF NOT EXISTS "Warehouse_isActive_idx" ON "Warehouse"("isActive");
