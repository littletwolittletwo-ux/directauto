-- ============================================================================
-- Direct Auto Platform Framework v2 Migration
-- Run in Supabase SQL Editor
-- ============================================================================

-- 1. New DealStatus enum (unified lifecycle replacing VehicleStatus/StockStatus/ApprovalStatus)
DO $$ BEGIN
  CREATE TYPE "DealStatus" AS ENUM (
    'SOURCED',
    'UNDER_OFFER',
    'CONTRACT_SIGNED',
    'COMMITTED',
    'APPROVED_FOR_PAYMENT',
    'PAYMENT_READY',
    'PAID',
    'LISTED',
    'SOLD',
    'CLOSED',
    'CANCELLED_DD_FAIL',
    'CANCELLED_INSPECTION_FAIL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. SellerType enum
DO $$ BEGIN
  CREATE TYPE "SellerType" AS ENUM (
    'PRIVATE_INDIVIDUAL',
    'PRIVATE_COMPANY',
    'LMCT_DEALER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. PpsrPath enum
DO $$ BEGIN
  CREATE TYPE "PpsrPath" AS ENUM (
    'DEPOSIT_AND_LODGE',
    'DEPOSIT_ONLY',
    'NO_DEPOSIT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Add new columns to Vehicle table
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "dealStatus" "DealStatus" DEFAULT 'SOURCED';
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "sellerType" "SellerType" DEFAULT 'PRIVATE_INDIVIDUAL';
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "ppsrPath" "PpsrPath" DEFAULT 'NO_DEPOSIT';
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "depositPaidCents" INTEGER DEFAULT 0;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMP;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "loadFeeCents" INTEGER DEFAULT 25000;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "resalePriceCents" INTEGER;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionCostCents" INTEGER;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionBookedAt" TIMESTAMP;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionCompletedAt" TIMESTAMP;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionPassed" BOOLEAN;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionReportUrl" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "contractSignedAt" TIMESTAMP;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "soldAt" TIMESTAMP;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "sellerAbn" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "sellerAcn" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "sellerGstRegistered" BOOLEAN;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "assignedSalesUserId" TEXT;

-- 5. Inspection Authorisation (separate signing document)
CREATE TABLE IF NOT EXISTS "InspectionAuthorisation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT NOT NULL UNIQUE,
  "ownerName" TEXT NOT NULL,
  "vehicleLocation" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "signingToken" TEXT UNIQUE,
  "sentAt" TIMESTAMP,
  "sentById" TEXT,
  "signedAt" TIMESTAMP,
  "signerName" TEXT,
  "signerIp" TEXT,
  "signerUserAgent" TEXT,
  "signatureData" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "InspectionAuthorisation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InspectionAuthorisation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
);

-- 6. Buyer-Dealer entity (resale counterparty)
CREATE TABLE IF NOT EXISTS "BuyerDealer" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "abn" TEXT,
  "lmctNumber" TEXT,
  "riskRating" TEXT DEFAULT 'STANDARD',
  "creditStatus" TEXT DEFAULT 'ACTIVE',
  "creditSuspendedAt" TIMESTAMP,
  "blacklistedAt" TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "BuyerDealer_pkey" PRIMARY KEY ("id")
);

-- 7. Link Vehicle to BuyerDealer (on resale)
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "buyerDealerId" TEXT;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_buyerDealerId_fkey"
  FOREIGN KEY ("buyerDealerId") REFERENCES "BuyerDealer"("id") ON DELETE SET NULL;

-- 8. DD Checklist (two-stage payment approval)
CREATE TABLE IF NOT EXISTS "DDChecklist" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT NOT NULL UNIQUE,
  -- Stage 1 checks (Winnie)
  "inspectionReviewed" BOOLEAN DEFAULT false,
  "inspectionReviewedAt" TIMESTAMP,
  "licenceVerified" BOOLEAN DEFAULT false,
  "licenceVerifiedAt" TIMESTAMP,
  "regoOwnerConfirmed" BOOLEAN DEFAULT false,
  "regoOwnerConfirmedAt" TIMESTAMP,
  "ppsrConfirmed" BOOLEAN DEFAULT false,
  "ppsrConfirmedAt" TIMESTAMP,
  "bankVerified" BOOLEAN DEFAULT false,
  "bankVerifiedAt" TIMESTAMP,
  "financePayoutVerified" BOOLEAN DEFAULT false,
  "financePayoutVerifiedAt" TIMESTAMP,
  "financePayoutNa" BOOLEAN DEFAULT false,
  -- Stage 1 completion
  "stage1CompletedAt" TIMESTAMP,
  "stage1CompletedById" TEXT,
  -- Stage 2 approval (Tuo)
  "stage2ApprovedAt" TIMESTAMP,
  "stage2ApprovedById" TEXT,
  "stage2RejectedAt" TIMESTAMP,
  "stage2RejectionReason" TEXT,
  -- Metadata
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "DDChecklist_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DDChecklist_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
);

-- 9. Commission Rate per sales team member
CREATE TABLE IF NOT EXISTS "CommissionRate" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "ratePercent" INTEGER NOT NULL DEFAULT 25,
  "effectiveFrom" TIMESTAMP NOT NULL DEFAULT now(),
  "effectiveTo" TIMESTAMP,
  "setByUserId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "CommissionRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- 10. Spotter Fee (calculated per deal)
CREATE TABLE IF NOT EXISTS "SpotterFee" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT NOT NULL UNIQUE,
  "salesUserId" TEXT NOT NULL,
  "ratePercent" INTEGER NOT NULL,
  "resalePriceCents" INTEGER NOT NULL,
  "costPriceCents" INTEGER NOT NULL,
  "totalExpensesCents" INTEGER NOT NULL,
  "loadFeeCents" INTEGER NOT NULL DEFAULT 25000,
  "netProfitCents" INTEGER NOT NULL,
  "feeAmountCents" INTEGER NOT NULL,
  "calculatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  "lockedAt" TIMESTAMP,
  "paidAt" TIMESTAMP,
  "paidInPayrollCycle" TEXT,
  "adjustmentNotes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "SpotterFee_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpotterFee_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
);

-- 11. Division 66 GST Register (Second-Hand Goods Margin Scheme)
CREATE TABLE IF NOT EXISTS "GSTRegisterEntry" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT NOT NULL,
  "acquisitionDate" DATE NOT NULL,
  "sellerName" TEXT NOT NULL,
  "sellerAbn" TEXT,
  "sellerGstRegistered" BOOLEAN NOT NULL DEFAULT false,
  "purchasePriceCents" INTEGER NOT NULL,
  "resalePriceCents" INTEGER,
  "marginCents" INTEGER,
  "notionalGstCents" INTEGER,
  "basQuarter" TEXT,
  "basYear" INTEGER,
  "gstCreditUnlockedAt" TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "GSTRegisterEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GSTRegisterEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
);

-- 12. AR Collection Actions (overdue tracking)
CREATE TABLE IF NOT EXISTS "CollectionAction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL,
  "buyerDealerId" TEXT,
  "actionType" TEXT NOT NULL,
  "dueDate" DATE,
  "daysOverdue" INTEGER,
  "sentAt" TIMESTAMP,
  "sentVia" TEXT,
  "completedAt" TIMESTAMP,
  "completedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "CollectionAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CollectionAction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ApplicationInvoice"("id") ON DELETE CASCADE
);

-- 13. Indexes
CREATE INDEX IF NOT EXISTS "Vehicle_dealStatus_idx" ON "Vehicle"("dealStatus");
CREATE INDEX IF NOT EXISTS "Vehicle_sellerType_idx" ON "Vehicle"("sellerType");
CREATE INDEX IF NOT EXISTS "Vehicle_ppsrPath_idx" ON "Vehicle"("ppsrPath");
CREATE INDEX IF NOT EXISTS "Vehicle_buyerDealerId_idx" ON "Vehicle"("buyerDealerId");
CREATE INDEX IF NOT EXISTS "BuyerDealer_creditStatus_idx" ON "BuyerDealer"("creditStatus");
CREATE INDEX IF NOT EXISTS "CollectionAction_invoiceId_idx" ON "CollectionAction"("invoiceId");
CREATE INDEX IF NOT EXISTS "GSTRegisterEntry_basQuarter_idx" ON "GSTRegisterEntry"("basQuarter", "basYear");
CREATE INDEX IF NOT EXISTS "SpotterFee_salesUserId_idx" ON "SpotterFee"("salesUserId");

-- 14. Backfill existing vehicles with appropriate deal status
UPDATE "Vehicle" SET "dealStatus" = 'CLOSED' WHERE "stockStatus" = 'SOLD';
UPDATE "Vehicle" SET "dealStatus" = 'LISTED' WHERE "stockStatus" = 'IN_STOCK';
UPDATE "Vehicle" SET "dealStatus" = 'PAID' WHERE "stockStatus" = 'AWAITING_DELIVERY';
UPDATE "Vehicle" SET "dealStatus" = 'CANCELLED_DD_FAIL' WHERE "status" = 'REJECTED';
UPDATE "Vehicle" SET "dealStatus" = 'APPROVED_FOR_PAYMENT' WHERE "approvalStatus" = 'APPROVED' AND "dealStatus" = 'SOURCED';
UPDATE "Vehicle" SET "dealStatus" = 'SOURCED' WHERE "dealStatus" IS NULL;
