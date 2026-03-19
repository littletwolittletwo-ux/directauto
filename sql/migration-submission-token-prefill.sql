-- Add vehicle prefill fields to SubmissionToken
-- Run in Supabase SQL Editor

ALTER TABLE "SubmissionToken" ADD COLUMN IF NOT EXISTS "vehicleMake" TEXT;
ALTER TABLE "SubmissionToken" ADD COLUMN IF NOT EXISTS "vehicleModel" TEXT;
ALTER TABLE "SubmissionToken" ADD COLUMN IF NOT EXISTS "vehicleYear" INTEGER;
ALTER TABLE "SubmissionToken" ADD COLUMN IF NOT EXISTS "vehicleOdometer" INTEGER;
ALTER TABLE "SubmissionToken" ADD COLUMN IF NOT EXISTS "vehicleRego" TEXT;
ALTER TABLE "SubmissionToken" ADD COLUMN IF NOT EXISTS "vehicleColour" TEXT;
ALTER TABLE "SubmissionToken" ADD COLUMN IF NOT EXISTS "vehicleBodyType" TEXT;
ALTER TABLE "SubmissionToken" ADD COLUMN IF NOT EXISTS "vehicleTransmission" TEXT;
