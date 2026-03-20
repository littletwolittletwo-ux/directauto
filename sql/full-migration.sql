-- ============================================
-- FULL MIGRATION — Direct Auto Wholesale
-- Safe to run multiple times (IF NOT EXISTS)
-- Paste this entire block into Supabase SQL Editor
-- ============================================

-- ==========================================
-- 1. ENUMS
-- ==========================================

-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'ACCOUNTS');
EXCEPTION WHEN duplicate_object THEN
  -- Add ACCOUNTS if enum exists but value doesn't
  BEGIN
    ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACCOUNTS';
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

DO $$ BEGIN
  CREATE TYPE "Source" AS ENUM ('PUBLIC_PORTAL', 'STAFF_ENTRY', 'SINGLE_USE_LINK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VehicleStatus" AS ENUM ('PENDING_VERIFICATION', 'DOCUMENTS_MISSING', 'RISK_FLAGGED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================
-- 2. TABLES
-- ==========================================

-- User
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'STAFF',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Vehicle
CREATE TABLE IF NOT EXISTS "Vehicle" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "confirmationNumber" TEXT NOT NULL,
  "vin" TEXT NOT NULL,
  "registrationNumber" TEXT NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "odometer" INTEGER NOT NULL,
  "sellerName" TEXT NOT NULL,
  "sellerPhone" TEXT NOT NULL,
  "sellerEmail" TEXT NOT NULL,
  "submissionSource" "Source" NOT NULL DEFAULT 'STAFF_ENTRY',
  "status" "VehicleStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "riskFlags" JSONB NOT NULL DEFAULT '[]',
  "adminNotes" JSONB NOT NULL DEFAULT '[]',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_confirmationNumber_key" ON "Vehicle"("confirmationNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_vin_key" ON "Vehicle"("vin");

-- SellerIdentity
CREATE TABLE IF NOT EXISTS "SellerIdentity" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT NOT NULL,
  "fullLegalName" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "driversLicenceNumber" TEXT NOT NULL,
  "licenceState" TEXT NOT NULL,
  "licenceExpiry" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerIdentity_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SellerIdentity_vehicleId_key" ON "SellerIdentity"("vehicleId");

-- OwnershipRecord
CREATE TABLE IF NOT EXISTS "OwnershipRecord" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnershipRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OwnershipRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "OwnershipRecord_vehicleId_key" ON "OwnershipRecord"("vehicleId");

-- PPSRCheck
CREATE TABLE IF NOT EXISTS "PPSRCheck" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedById" TEXT,
  "isWrittenOff" BOOLEAN NOT NULL DEFAULT false,
  "isStolen" BOOLEAN NOT NULL DEFAULT false,
  "hasFinance" BOOLEAN NOT NULL DEFAULT false,
  "certificateDocId" TEXT,
  "rawResult" JSONB,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  CONSTRAINT "PPSRCheck_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PPSRCheck_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PPSRCheck_vehicleId_key" ON "PPSRCheck"("vehicleId");

-- Document
CREATE TABLE IF NOT EXISTS "Document" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "uploadedById" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
);

-- AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL,
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

-- SubmissionToken
CREATE TABLE IF NOT EXISTS "SubmissionToken" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "token" TEXT NOT NULL,
  "vehicleVin" TEXT,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmissionToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SubmissionToken_token_key" ON "SubmissionToken"("token");

-- Settings
CREATE TABLE IF NOT EXISTS "Settings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "dealershipName" TEXT NOT NULL DEFAULT 'Direct Auto Wholesale',
  "logoPath" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#1e40af',
  "contactEmail" TEXT,
  "notifyOnSubmit" BOOLEAN NOT NULL DEFAULT true,
  "notifyOnPPSR" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- SaleAgreement
CREATE TABLE IF NOT EXISTS "SaleAgreement" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT NOT NULL,
  "salePrice" DOUBLE PRECISION NOT NULL,
  "buyerName" TEXT NOT NULL,
  "buyerEmail" TEXT NOT NULL,
  "buyerPhone" TEXT,
  "buyerAddress" TEXT,
  "agreementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "sentById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "signingToken" TEXT,
  "signedAt" TIMESTAMP(3),
  "signerIp" TEXT,
  "signerName" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleAgreement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleAgreement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SaleAgreement_vehicleId_key" ON "SaleAgreement"("vehicleId");
CREATE UNIQUE INDEX IF NOT EXISTS "SaleAgreement_signingToken_key" ON "SaleAgreement"("signingToken");

-- ==========================================
-- 3. ADD MISSING COLUMNS (safe with IF NOT EXISTS)
-- ==========================================

-- Vehicle: optional fields that may be missing
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "sellerPrice" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "submissionToken" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "sellerSignature" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

-- Vehicle: Autograb integration
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbVehicleId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbTradeValue" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbRetailValue" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbColour" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbEngine" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbTransmission" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbBodyType" TEXT;

-- Vehicle: Inspection
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionCondition" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionRepairCost" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionNotes" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectedAt" TIMESTAMP(3);

-- Vehicle: DocuSign
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "docusignEnvelopeId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "docusignStatus" TEXT NOT NULL DEFAULT 'NOT_SENT';
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "docusignSignedAt" TIMESTAMP(3);

-- Vehicle: Accounts & pricing
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "purchasePrice" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "offerPrice" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "accountsApprovedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "accountsApprovedById" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "easycarsSyncedAt" TIMESTAMP(3);

-- SellerIdentity: optional fields
ALTER TABLE "SellerIdentity" ADD COLUMN IF NOT EXISTS "licenceFrontDocId" TEXT;
ALTER TABLE "SellerIdentity" ADD COLUMN IF NOT EXISTS "licenceBackDocId" TEXT;
ALTER TABLE "SellerIdentity" ADD COLUMN IF NOT EXISTS "selfieDocId" TEXT;
ALTER TABLE "SellerIdentity" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "SellerIdentity" ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;

-- Settings: ABN
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "abn" TEXT;

-- ==========================================
-- 4. FOREIGN KEY for Vehicle.createdById
-- ==========================================
DO $$ BEGIN
  ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================
-- 5. INSERT default Settings row if missing
-- ==========================================
INSERT INTO "Settings" ("id", "dealershipName", "primaryColor", "notifyOnSubmit", "notifyOnPPSR")
VALUES ('singleton', 'Direct Auto Wholesale', '#1e40af', true, true)
ON CONFLICT ("id") DO NOTHING;
