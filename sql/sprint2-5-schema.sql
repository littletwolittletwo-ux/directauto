-- Sprints 2-4: Invoicing, Expenses, PPSR schema additions
-- Run after sprint1-approval-workflow.sql

-- 1. StockStatus enum
DO $$ BEGIN
  CREATE TYPE "StockStatus" AS ENUM ('AWAITING_DELIVERY', 'IN_STOCK', 'SOLD', 'WITHDRAWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add stockStatus to Vehicle
ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "stockStatus" "StockStatus" NOT NULL DEFAULT 'AWAITING_DELIVERY';

CREATE INDEX IF NOT EXISTS "Vehicle_stockStatus_idx" ON "Vehicle"("stockStatus");

-- 3. ApplicationInvoice table
CREATE TABLE IF NOT EXISTS "ApplicationInvoice" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "vehicleId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "buyerName" TEXT NOT NULL,
  "buyerEmail" TEXT NOT NULL,
  "buyerAddress" TEXT,
  "vehicleDescription" TEXT NOT NULL,
  "subtotalCents" INTEGER NOT NULL,
  "gstCents" INTEGER NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "pdfUrl" TEXT,
  "sentAt" TIMESTAMP(3),
  "sentToEmail" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApplicationInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationInvoice_invoiceNumber_key" ON "ApplicationInvoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "ApplicationInvoice_vehicleId_idx" ON "ApplicationInvoice"("vehicleId");
CREATE INDEX IF NOT EXISTS "ApplicationInvoice_createdAt_idx" ON "ApplicationInvoice"("createdAt");

DO $$ BEGIN
  ALTER TABLE "ApplicationInvoice"
    ADD CONSTRAINT "ApplicationInvoice_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. InvoiceSequence table (singleton for sequential numbering)
CREATE TABLE IF NOT EXISTS "InvoiceSequence" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "lastNum" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

INSERT INTO "InvoiceSequence" ("id", "lastNum") VALUES ('singleton', 0)
ON CONFLICT ("id") DO NOTHING;

-- 5. ExpenseCategory table
CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- Seed default categories
INSERT INTO "ExpenseCategory" ("id", "name", "sortOrder") VALUES
  (gen_random_uuid(), 'Purchase Price', 1),
  (gen_random_uuid(), 'Inspection', 2),
  (gen_random_uuid(), 'Transport/Freight', 3),
  (gen_random_uuid(), 'Reconditioning/Repairs', 4),
  (gen_random_uuid(), 'Detailing', 5),
  (gen_random_uuid(), 'PPSR Fees', 6),
  (gen_random_uuid(), 'Registration/Transfer', 7),
  (gen_random_uuid(), 'Advertising', 8),
  (gen_random_uuid(), 'Finance/Floorplan', 9),
  (gen_random_uuid(), 'Other', 10)
ON CONFLICT ("name") DO NOTHING;

-- 6. ApplicationExpense table
CREATE TABLE IF NOT EXISTS "ApplicationExpense" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "vehicleId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "supplier" TEXT,
  "notes" TEXT,
  "receiptFileUrl" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApplicationExpense_vehicleId_idx" ON "ApplicationExpense"("vehicleId");
CREATE INDEX IF NOT EXISTS "ApplicationExpense_expenseDate_idx" ON "ApplicationExpense"("expenseDate");

DO $$ BEGIN
  ALTER TABLE "ApplicationExpense"
    ADD CONSTRAINT "ApplicationExpense_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ApplicationExpense"
    ADD CONSTRAINT "ApplicationExpense_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. PPSRRecord table (for lodgement, separate from existing PPSRCheck)
CREATE TABLE IF NOT EXISTS "PPSRRecord" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "vehicleId" TEXT NOT NULL,
  "registrationNumber" TEXT,
  "lodgedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "feeCents" INTEGER NOT NULL DEFAULT 0,
  "provider" TEXT,
  "providerReference" TEXT,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "errorMessage" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PPSRRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PPSRRecord_vehicleId_idx" ON "PPSRRecord"("vehicleId");

DO $$ BEGIN
  ALTER TABLE "PPSRRecord"
    ADD CONSTRAINT "PPSRRecord_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
