-- ============================================
-- Migration: Additional fields (offerPrice, Autograb details, ABN)
-- Run this in Supabase SQL Editor AFTER the previous migration
-- ============================================

-- 1. Add Autograb detail columns to Vehicle
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbColour" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbEngine" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbTransmission" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "autograbBodyType" TEXT;

-- 2. Add offerPrice to Vehicle
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "offerPrice" DOUBLE PRECISION;

-- 3. Add ABN to Settings
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "abn" TEXT;
