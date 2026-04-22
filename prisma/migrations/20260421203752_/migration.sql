/*
  Warnings:

  - You are about to drop the column `fiscalYear` on the `AccountingPeriod` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,code]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,fiscalYearId,name]` on the table `AccountingPeriod` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reversalEntryId]` on the table `JournalEntry` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tenantId` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `AccountBalanceHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fiscalYearId` to the `AccountingPeriod` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `AccountingPeriod` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `BudgetEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `COGSTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `CostLayer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `FIFOLayer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `JournalEntryLine` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `PaymentAllocation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `StockReservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `WorkInProgress` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AccountBalanceHistory" DROP CONSTRAINT "AccountBalanceHistory_accountCode_fkey";

-- DropForeignKey
ALTER TABLE "BudgetEntry" DROP CONSTRAINT "BudgetEntry_accountCode_fkey";

-- DropForeignKey
ALTER TABLE "JournalEntryLine" DROP CONSTRAINT "JournalEntryLine_accountCode_fkey";

-- DropIndex
DROP INDEX "Account_code_key";

-- DropIndex
DROP INDEX "AccountingPeriod_fiscalYear_idx";

-- DropIndex
DROP INDEX "AccountingPeriod_fiscalYear_name_key";

-- DropIndex
DROP INDEX "COGSTransaction_referenceType_idx";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AccountBalanceHistory" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AccountingPeriod" DROP COLUMN "fiscalYear",
ADD COLUMN     "fiscalYearId" TEXT NOT NULL,
ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "BudgetEntry" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "COGSTransaction" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CostLayer" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FIFOLayer" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "referenceType" TEXT,
ADD COLUMN     "totalCost" DOUBLE PRECISION,
ADD COLUMN     "unitCost" DOUBLE PRECISION,
ADD COLUMN     "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "accountingPeriodId" TEXT,
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "fiscalYearId" TEXT,
ADD COLUMN     "reversalEntryId" TEXT,
ADD COLUMN     "sourceEventId" TEXT;

-- AlterTable
ALTER TABLE "JournalEntryLine" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PaymentAllocation" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockReservation" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkInProgress" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "errorMessage" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalYear_tenantId_idx" ON "FiscalYear"("tenantId");

-- CreateIndex
CREATE INDEX "FiscalYear_year_idx" ON "FiscalYear"("year");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_tenantId_year_key" ON "FiscalYear"("tenantId", "year");

-- CreateIndex
CREATE INDEX "OutboxEvent_tenantId_status_idx" ON "OutboxEvent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "OutboxEvent_eventType_status_idx" ON "OutboxEvent"("eventType", "status");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateId_eventType_idx" ON "OutboxEvent"("aggregateId", "eventType");

-- CreateIndex
CREATE INDEX "OutboxEvent_occurredAt_idx" ON "OutboxEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_processedAt_idx" ON "OutboxEvent"("processedAt");

-- CreateIndex
CREATE INDEX "Account_tenantId_idx" ON "Account"("tenantId");

-- CreateIndex
CREATE INDEX "Account_type_idx" ON "Account"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Account_tenantId_code_key" ON "Account"("tenantId", "code");

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_fiscalYearId_idx" ON "AccountingPeriod"("tenantId", "fiscalYearId");

-- CreateIndex
CREATE INDEX "AccountingPeriod_tenantId_idx" ON "AccountingPeriod"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_tenantId_fiscalYearId_name_key" ON "AccountingPeriod"("tenantId", "fiscalYearId", "name");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "COGSTransaction_tenantId_idx" ON "COGSTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "CostLayer_tenantId_idx" ON "CostLayer"("tenantId");

-- CreateIndex
CREATE INDEX "FIFOLayer_tenantId_idx" ON "FIFOLayer"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_warehouseId_idx" ON "InventoryTransaction"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversalEntryId_key" ON "JournalEntry"("reversalEntryId");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_fiscalYearId_idx" ON "JournalEntry"("tenantId", "fiscalYearId");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_accountingPeriodId_idx" ON "JournalEntry"("tenantId", "accountingPeriodId");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_sourceEventId_idx" ON "JournalEntry"("tenantId", "sourceEventId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_tenantId_idx" ON "JournalEntryLine"("tenantId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_tenantId_accountCode_idx" ON "JournalEntryLine"("tenantId", "accountCode");

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_idx" ON "PaymentAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "StockReservation_tenantId_idx" ON "StockReservation"("tenantId");

-- CreateIndex
CREATE INDEX "WorkInProgress_tenantId_idx" ON "WorkInProgress"("tenantId");

-- AddForeignKey
ALTER TABLE "WorkInProgress" ADD CONSTRAINT "WorkInProgress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_tenantId_accountCode_fkey" FOREIGN KEY ("tenantId", "accountCode") REFERENCES "Account"("tenantId", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalEntryId_fkey" FOREIGN KEY ("reversalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountBalanceHistory" ADD CONSTRAINT "AccountBalanceHistory_tenantId_accountCode_fkey" FOREIGN KEY ("tenantId", "accountCode") REFERENCES "Account"("tenantId", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEntry" ADD CONSTRAINT "BudgetEntry_tenantId_accountCode_fkey" FOREIGN KEY ("tenantId", "accountCode") REFERENCES "Account"("tenantId", "code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
