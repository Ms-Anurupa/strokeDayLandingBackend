-- CreateEnum
CREATE TYPE "TalentCategory" AS ENUM ('SINGING', 'DANCING', 'STANDUP_COMEDY');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "city" TEXT,
    "talentCategory" "TalentCategory" NOT NULL,
    "performanceTitle" TEXT,
    "performanceDuration" INTEGER,
    "videoOriginalName" TEXT,
    "videoUrl" TEXT,
    "videoMimeType" TEXT,
    "videoSize" INTEGER,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_registrationNumber_key" ON "Participant"("registrationNumber");
