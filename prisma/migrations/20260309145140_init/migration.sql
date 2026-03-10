-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('PUBLIC_PORTAL', 'STAFF_ENTRY', 'SINGLE_USE_LINK');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('PENDING_VERIFICATION', 'DOCUMENTS_MISSING', 'RISK_FLAGGED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "confirmationNumber" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "odometer" INTEGER NOT NULL,
    "sellerPrice" DOUBLE PRECISION,
    "location" TEXT,
    "sellerName" TEXT NOT NULL,
    "sellerPhone" TEXT NOT NULL,
    "sellerEmail" TEXT NOT NULL,
    "submissionSource" "Source" NOT NULL DEFAULT 'STAFF_ENTRY',
    "submissionToken" TEXT,
    "ipAddress" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskFlags" JSONB NOT NULL DEFAULT '[]',
    "adminNotes" JSONB NOT NULL DEFAULT '[]',
    "sellerSignature" TEXT,
    "signedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerIdentity" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "fullLegalName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "driversLicenceNumber" TEXT NOT NULL,
    "licenceState" TEXT NOT NULL,
    "licenceExpiry" TIMESTAMP(3) NOT NULL,
    "licenceFrontDocId" TEXT,
    "licenceBackDocId" TEXT,
    "selfieDocId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,

    CONSTRAINT "SellerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnershipRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PPSRCheck" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedById" TEXT,
    "isWrittenOff" BOOLEAN NOT NULL DEFAULT false,
    "isStolen" BOOLEAN NOT NULL DEFAULT false,
    "hasFinance" BOOLEAN NOT NULL DEFAULT false,
    "certificateDocId" TEXT,
    "rawResult" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "PPSRCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "vehicleVin" TEXT,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "dealershipName" TEXT NOT NULL DEFAULT 'My Dealership',
    "logoPath" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1e40af',
    "contactEmail" TEXT,
    "notifyOnSubmit" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnPPSR" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_confirmationNumber_key" ON "Vehicle"("confirmationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "SellerIdentity_vehicleId_key" ON "SellerIdentity"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipRecord_vehicleId_key" ON "OwnershipRecord"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "PPSRCheck_vehicleId_key" ON "PPSRCheck"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionToken_token_key" ON "SubmissionToken"("token");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerIdentity" ADD CONSTRAINT "SellerIdentity_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipRecord" ADD CONSTRAINT "OwnershipRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PPSRCheck" ADD CONSTRAINT "PPSRCheck_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
