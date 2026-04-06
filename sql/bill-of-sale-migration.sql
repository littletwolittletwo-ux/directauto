-- Bill of Sale migration
-- Run this in Supabase SQL Editor

-- Create BillOfSale table
CREATE TABLE IF NOT EXISTS "BillOfSale" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "vehicleId" TEXT NOT NULL,

  -- Seller details
  "sellerFullName" TEXT NOT NULL,
  "sellerAddress" TEXT,
  "sellerSuburb" TEXT,
  "sellerState" TEXT,
  "sellerPostcode" TEXT,
  "sellerCustomerId" TEXT,
  "sellerDob" TEXT,
  "sellerPhone" TEXT NOT NULL,
  "sellerEmail" TEXT NOT NULL,
  "sellerLicenceNumber" TEXT,

  -- Vehicle details (snapshot)
  "registrationNumber" TEXT NOT NULL,
  "stateOfRegistration" TEXT,
  "vinNumber" TEXT NOT NULL,
  "engineNumber" TEXT,
  "yearOfManufacture" INTEGER NOT NULL,
  "vehicleMake" TEXT NOT NULL,
  "vehicleModel" TEXT NOT NULL,
  "vehicleVariant" TEXT,
  "bodyType" TEXT,
  "colour" TEXT,
  "fuelType" TEXT,
  "transmission" TEXT,
  "odometerReading" INTEGER NOT NULL,
  "numberOfKeys" TEXT,

  -- Sale details
  "purchasePrice" DOUBLE PRECISION NOT NULL,
  "depositPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceDue" DOUBLE PRECISION NOT NULL,
  "paymentMethod" TEXT,
  "dateOfSale" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Vehicle condition
  "knownDefects" TEXT,

  -- Status & signing
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "signingToken" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "sentById" TEXT,
  "viewedAt" TIMESTAMP(3),

  -- Seller signature
  "signedAt" TIMESTAMP(3),
  "signerName" TEXT,
  "signerIp" TEXT,
  "signerUserAgent" TEXT,
  "signatureData" TEXT,

  -- PDF
  "pdfStoragePath" TEXT,

  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BillOfSale_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "BillOfSale_vehicleId_key" ON "BillOfSale"("vehicleId");
CREATE UNIQUE INDEX IF NOT EXISTS "BillOfSale_signingToken_key" ON "BillOfSale"("signingToken");

-- Add foreign key
ALTER TABLE "BillOfSale" ADD CONSTRAINT "BillOfSale_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create BillOfSaleEvent table
CREATE TABLE IF NOT EXISTS "BillOfSaleEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "billOfSaleId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BillOfSaleEvent_pkey" PRIMARY KEY ("id")
);

-- Add foreign key for events
ALTER TABLE "BillOfSaleEvent" ADD CONSTRAINT "BillOfSaleEvent_billOfSaleId_fkey"
  FOREIGN KEY ("billOfSaleId") REFERENCES "BillOfSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index for faster event lookups
CREATE INDEX IF NOT EXISTS "BillOfSaleEvent_billOfSaleId_idx" ON "BillOfSaleEvent"("billOfSaleId");
