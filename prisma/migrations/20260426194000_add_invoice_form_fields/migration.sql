-- Add new fields to SalesInvoice / PurchaseInvoice and their item tables to
-- support the upgraded invoice form (template, sales rep, issue date,
-- payment terms, currency) and per-line discount/tax columns.
--
-- All new columns are nullable or have safe defaults so existing rows
-- continue to validate without backfill. The migration is forward-only
-- and does NOT mutate or drop any existing data.

-- ──────────────────────────────────────────────────────────────────────────
-- SalesInvoice
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE "SalesInvoice"
  ADD COLUMN IF NOT EXISTS "issueDate"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "salesRepId"       TEXT,
  ADD COLUMN IF NOT EXISTS "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "template"         TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS "currency"         TEXT NOT NULL DEFAULT 'EGP';

-- FK on salesRepId → User(id). ON DELETE SET NULL preserves invoices when
-- a rep is removed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SalesInvoice_salesRepId_fkey'
  ) THEN
    ALTER TABLE "SalesInvoice"
      ADD CONSTRAINT "SalesInvoice_salesRepId_fkey"
      FOREIGN KEY ("salesRepId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SalesInvoice_salesRepId_idx" ON "SalesInvoice"("salesRepId");

-- ──────────────────────────────────────────────────────────────────────────
-- SalesInvoiceItem
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE "SalesInvoiceItem"
  ADD COLUMN IF NOT EXISTS "description"     TEXT,
  ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxRate"         DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ──────────────────────────────────────────────────────────────────────────
-- PurchaseInvoice
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE "PurchaseInvoice"
  ADD COLUMN IF NOT EXISTS "issueDate"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "purchaseRepId"    TEXT,
  ADD COLUMN IF NOT EXISTS "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "template"         TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS "currency"         TEXT NOT NULL DEFAULT 'EGP',
  ADD COLUMN IF NOT EXISTS "discount"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax"              DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grandTotal"       DOUBLE PRECISION NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseInvoice_purchaseRepId_fkey'
  ) THEN
    ALTER TABLE "PurchaseInvoice"
      ADD CONSTRAINT "PurchaseInvoice_purchaseRepId_fkey"
      FOREIGN KEY ("purchaseRepId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PurchaseInvoice_purchaseRepId_idx" ON "PurchaseInvoice"("purchaseRepId");

-- ──────────────────────────────────────────────────────────────────────────
-- PurchaseInvoiceItem
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE "PurchaseInvoiceItem"
  ADD COLUMN IF NOT EXISTS "description"     TEXT,
  ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxRate"         DOUBLE PRECISION NOT NULL DEFAULT 0;
