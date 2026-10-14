-- Idempotent reconcile so that `prisma migrate deploy` on a fresh database
-- matches prisma/schema.prisma. On a database that already has these objects
-- every statement is a no-op.

-- The init migration created upper-case enum values, the schema uses lower-case.
ALTER TYPE "TalentCategory" ADD VALUE IF NOT EXISTS 'singing';
ALTER TYPE "TalentCategory" ADD VALUE IF NOT EXISTS 'dancing';
ALTER TYPE "TalentCategory" ADD VALUE IF NOT EXISTS 'stand_up_comedy';

-- Admin accounts for the CMS.
CREATE TABLE IF NOT EXISTS "Admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Administrator',
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Admin_email_key" ON "Admin"("email");
