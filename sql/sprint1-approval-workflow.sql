-- Sprint 1: Purchase Approval Workflow
-- Adds approval status tracking and approval history

-- 1. Create ApprovalStatus enum
DO $$ BEGIN
  CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add approval fields to Vehicle table
ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "approvalComment" TEXT;

-- 3. Create ApprovalHistory table
CREATE TABLE IF NOT EXISTS "ApprovalHistory" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "vehicleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- 4. Add foreign keys
DO $$ BEGIN
  ALTER TABLE "ApprovalHistory"
    ADD CONSTRAINT "ApprovalHistory_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ApprovalHistory"
    ADD CONSTRAINT "ApprovalHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS "ApprovalHistory_vehicleId_idx" ON "ApprovalHistory"("vehicleId");
CREATE INDEX IF NOT EXISTS "Vehicle_approvalStatus_idx" ON "Vehicle"("approvalStatus");

-- 6. Backfill ALL existing vehicles to APPROVED (grandfathered).
--    We do NOT want historical vehicles sitting in a pending queue.
UPDATE "Vehicle"
SET "approvalStatus" = 'APPROVED'
WHERE "approvalStatus" = 'PENDING';

-- 7. Create synthetic history entries for ALL backfilled vehicles.
--    Uses the original approver if available, otherwise the creator,
--    otherwise the first ADMIN user. Comment clearly marks these as migration backfills.
INSERT INTO "ApprovalHistory" ("id", "vehicleId", "userId", "action", "comment", "createdAt")
SELECT
  gen_random_uuid(),
  v."id",
  COALESCE(
    v."accountsApprovedById",
    v."createdById",
    (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' LIMIT 1)
  ),
  'approved',
  'Auto-approved: backfilled during Sprint 1 migration (historical vehicle)',
  COALESCE(v."accountsApprovedAt", v."submittedAt", NOW())
FROM "Vehicle" v
WHERE NOT EXISTS (
    SELECT 1 FROM "ApprovalHistory" ah
    WHERE ah."vehicleId" = v."id"
  );
