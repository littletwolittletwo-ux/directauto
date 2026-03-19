-- Add sold tracking fields to Vehicle
-- Run in Supabase SQL Editor

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "soldAt" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "soldPrice" DOUBLE PRECISION;
