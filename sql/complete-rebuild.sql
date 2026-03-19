-- ============================================================
-- COMPLETE DATABASE REBUILD — Direct Auto Wholesale
-- Run once in Supabase SQL Editor on a fresh database
-- WARNING: This drops ALL existing tables and data
-- ============================================================

-- ==========================================
-- 1. DROP EVERYTHING
-- ==========================================

DROP TABLE IF EXISTS "SaleAgreement" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "Document" CASCADE;
DROP TABLE IF EXISTS "PPSRCheck" CASCADE;
DROP TABLE IF EXISTS "OwnershipRecord" CASCADE;
DROP TABLE IF EXISTS "SellerIdentity" CASCADE;
DROP TABLE IF EXISTS "SubmissionToken" CASCADE;
DROP TABLE IF EXISTS "Vehicle" CASCADE;
DROP TABLE IF EXISTS "Settings" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

DROP TYPE IF EXISTS "Role" CASCADE;
DROP TYPE IF EXISTS "Source" CASCADE;
DROP TYPE IF EXISTS "VehicleStatus" CASCADE;

-- ==========================================
-- 2. ENUMS
-- ==========================================

CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'ACCOUNTS');
CREATE TYPE "Source" AS ENUM ('PUBLIC_PORTAL', 'STAFF_ENTRY', 'SINGLE_USE_LINK');
CREATE TYPE "VehicleStatus" AS ENUM ('PENDING_VERIFICATION', 'DOCUMENTS_MISSING', 'RISK_FLAGGED', 'APPROVED', 'REJECTED');

-- ==========================================
-- 3. TABLES
-- ==========================================

-- User
CREATE TABLE "User" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "email"        TEXT        NOT NULL,
  "passwordHash" TEXT        NOT NULL,
  "name"         TEXT        NOT NULL,
  "role"         "Role"      NOT NULL DEFAULT 'STAFF',
  "active"       BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Vehicle
CREATE TABLE "Vehicle" (
  "id"                   TEXT            NOT NULL DEFAULT gen_random_uuid()::text,
  "confirmationNumber"   TEXT            NOT NULL,
  "vin"                  TEXT            NOT NULL,
  "registrationNumber"   TEXT            NOT NULL,
  "make"                 TEXT            NOT NULL,
  "model"                TEXT            NOT NULL,
  "year"                 INTEGER         NOT NULL,
  "odometer"             INTEGER         NOT NULL,
  "sellerPrice"          DOUBLE PRECISION,
  "location"             TEXT,
  "sellerName"           TEXT            NOT NULL,
  "sellerPhone"          TEXT            NOT NULL,
  "sellerEmail"          TEXT            NOT NULL,
  "submissionSource"     "Source"        NOT NULL DEFAULT 'STAFF_ENTRY',
  "submissionToken"      TEXT,
  "ipAddress"            TEXT,
  "status"               "VehicleStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "riskScore"            INTEGER         NOT NULL DEFAULT 0,
  "riskFlags"            JSONB           NOT NULL DEFAULT '[]',
  "adminNotes"           JSONB           NOT NULL DEFAULT '[]',
  "sellerSignature"      TEXT,
  "signedAt"             TIMESTAMP(3),
  "submittedAt"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "autograbVehicleId"    TEXT,
  "autograbTradeValue"   DOUBLE PRECISION,
  "autograbRetailValue"  DOUBLE PRECISION,
  "autograbColour"       TEXT,
  "autograbEngine"       TEXT,
  "autograbTransmission" TEXT,
  "autograbBodyType"     TEXT,
  "inspectionCondition"  TEXT,
  "inspectionRepairCost" DOUBLE PRECISION,
  "inspectionNotes"      TEXT,
  "inspectedAt"          TIMESTAMP(3),
  "docusignEnvelopeId"   TEXT,
  "docusignStatus"       TEXT            NOT NULL DEFAULT 'NOT_SENT',
  "docusignSignedAt"     TIMESTAMP(3),
  "purchasePrice"        DOUBLE PRECISION,
  "offerPrice"           DOUBLE PRECISION,
  "accountsApprovedAt"   TIMESTAMP(3),
  "accountsApprovedById" TEXT,
  "easycarsSyncedAt"     TIMESTAMP(3),
  "createdById"          TEXT,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- SellerIdentity
CREATE TABLE "SellerIdentity" (
  "id"                   TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId"            TEXT         NOT NULL,
  "fullLegalName"        TEXT         NOT NULL,
  "address"              TEXT         NOT NULL,
  "driversLicenceNumber" TEXT         NOT NULL,
  "licenceState"         TEXT         NOT NULL,
  "licenceExpiry"        TIMESTAMP(3) NOT NULL,
  "licenceFrontDocId"    TEXT,
  "licenceBackDocId"     TEXT,
  "selfieDocId"          TEXT,
  "verifiedAt"           TIMESTAMP(3),
  "verifiedById"         TEXT,
  CONSTRAINT "SellerIdentity_pkey" PRIMARY KEY ("id")
);

-- OwnershipRecord
CREATE TABLE "OwnershipRecord" (
  "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId"    TEXT         NOT NULL,
  "documentType" TEXT         NOT NULL,
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnershipRecord_pkey" PRIMARY KEY ("id")
);

-- PPSRCheck
CREATE TABLE "PPSRCheck" (
  "id"               TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId"        TEXT         NOT NULL,
  "checkedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedById"      TEXT,
  "isWrittenOff"     BOOLEAN      NOT NULL DEFAULT false,
  "isStolen"         BOOLEAN      NOT NULL DEFAULT false,
  "hasFinance"       BOOLEAN      NOT NULL DEFAULT false,
  "certificateDocId" TEXT,
  "rawResult"        JSONB,
  "status"           TEXT         NOT NULL DEFAULT 'PENDING',
  CONSTRAINT "PPSRCheck_pkey" PRIMARY KEY ("id")
);

-- Document
CREATE TABLE "Document" (
  "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId"    TEXT         NOT NULL,
  "category"     TEXT         NOT NULL,
  "originalName" TEXT         NOT NULL,
  "storagePath"  TEXT         NOT NULL,
  "mimeType"     TEXT         NOT NULL,
  "sizeBytes"    INTEGER      NOT NULL,
  "uploadedById" TEXT,
  "uploadedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- AuditLog
CREATE TABLE "AuditLog" (
  "id"        TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT,
  "userId"    TEXT,
  "action"    TEXT         NOT NULL,
  "details"   JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- SubmissionToken
CREATE TABLE "SubmissionToken" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "token"      TEXT         NOT NULL,
  "vehicleVin" TEXT,
  "used"       BOOLEAN      NOT NULL DEFAULT false,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmissionToken_pkey" PRIMARY KEY ("id")
);

-- Settings
CREATE TABLE "Settings" (
  "id"             TEXT    NOT NULL DEFAULT 'singleton',
  "dealershipName" TEXT    NOT NULL DEFAULT 'Direct Auto Wholesale',
  "logoPath"       TEXT,
  "primaryColor"   TEXT    NOT NULL DEFAULT '#1e40af',
  "contactEmail"   TEXT,
  "notifyOnSubmit" BOOLEAN NOT NULL DEFAULT true,
  "notifyOnPPSR"   BOOLEAN NOT NULL DEFAULT true,
  "abn"            TEXT,
  CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- SaleAgreement
CREATE TABLE "SaleAgreement" (
  "id"            TEXT            NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId"     TEXT            NOT NULL,
  "salePrice"     DOUBLE PRECISION NOT NULL,
  "buyerName"     TEXT            NOT NULL,
  "buyerEmail"    TEXT            NOT NULL,
  "buyerPhone"    TEXT,
  "buyerAddress"  TEXT,
  "agreementDate" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt"        TIMESTAMP(3),
  "sentById"      TEXT,
  "status"        TEXT            NOT NULL DEFAULT 'DRAFT',
  "signingToken"  TEXT,
  "signedAt"      TIMESTAMP(3),
  "signerIp"      TEXT,
  "signerName"    TEXT,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleAgreement_pkey" PRIMARY KEY ("id")
);

-- ==========================================
-- 4. UNIQUE INDEXES
-- ==========================================

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Vehicle_confirmationNumber_key" ON "Vehicle"("confirmationNumber");
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");
CREATE UNIQUE INDEX "SellerIdentity_vehicleId_key" ON "SellerIdentity"("vehicleId");
CREATE UNIQUE INDEX "OwnershipRecord_vehicleId_key" ON "OwnershipRecord"("vehicleId");
CREATE UNIQUE INDEX "PPSRCheck_vehicleId_key" ON "PPSRCheck"("vehicleId");
CREATE UNIQUE INDEX "SubmissionToken_token_key" ON "SubmissionToken"("token");
CREATE UNIQUE INDEX "SaleAgreement_vehicleId_key" ON "SaleAgreement"("vehicleId");
CREATE UNIQUE INDEX "SaleAgreement_signingToken_key" ON "SaleAgreement"("signingToken");

-- ==========================================
-- 5. FOREIGN KEYS
-- ==========================================

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "SellerIdentity" ADD CONSTRAINT "SellerIdentity_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE;

ALTER TABLE "OwnershipRecord" ADD CONSTRAINT "OwnershipRecord_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE;

ALTER TABLE "PPSRCheck" ADD CONSTRAINT "PPSRCheck_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "SaleAgreement" ADD CONSTRAINT "SaleAgreement_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE;

-- ==========================================
-- 6. SEED DATA
-- ==========================================

-- Default settings
INSERT INTO "Settings" ("id", "dealershipName", "primaryColor", "contactEmail", "notifyOnSubmit", "notifyOnPPSR")
VALUES ('singleton', 'Direct Auto Wholesale', '#1e40af', 'contact@directauto.info', true, true);

-- Admin user (password: $RichardJohnson)
INSERT INTO "User" ("id", "email", "passwordHash", "name", "role", "active", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'contact@directauto.info',
  '$2b$12$iELACrNnrCvl8Knk1TYurO/xCimSdzM8RugLxjSXzUyB44VPm9FaC',
  'Direct Auto Admin',
  'ADMIN',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
