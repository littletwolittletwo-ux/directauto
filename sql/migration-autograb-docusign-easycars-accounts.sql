-- ============================================
-- Migration: Autograb, DocuSign, EasyCars, Inspection, Accounts
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add ACCOUNTS to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ACCOUNTS';

-- 2. Add new Vehicle columns
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbVehicleId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbTradeValue" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbRetailValue" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionCondition" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionRepairCost" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectionNotes" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "inspectedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "docusignEnvelopeId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "docusignStatus" TEXT NOT NULL DEFAULT 'NOT_SENT';
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "docusignSignedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "purchasePrice" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "accountsApprovedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "accountsApprovedById" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "easycarsSyncedAt" TIMESTAMP(3);
