-- Sale Agreement feature: Add fields to Vehicle table
-- Run this in Supabase SQL Editor

ALTER TABLE "Vehicle" ADD COLUMN "purchasePrice" DOUBLE PRECISION;
ALTER TABLE "Vehicle" ADD COLUMN "saleAgreementToken" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "saleAgreementSentAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "saleAgreementSignedAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "saleAgreementSignature" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "saleAgreementStatus" TEXT NOT NULL DEFAULT 'NOT_SENT';

-- Add unique constraint on saleAgreementToken
CREATE UNIQUE INDEX "Vehicle_saleAgreementToken_key" ON "Vehicle"("saleAgreementToken");
