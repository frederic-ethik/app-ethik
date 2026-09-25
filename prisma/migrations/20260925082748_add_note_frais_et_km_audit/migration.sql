-- AlterTable
ALTER TABLE "Deplacement" ADD COLUMN     "includedInNoteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "kmCumulAuMomentCalcul" DOUBLE PRECISION,
ADD COLUMN     "kmTrancheAppliquee" INTEGER;

-- CreateTable
CREATE TABLE "NoteFrais" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "debut" DATE NOT NULL,
    "fin" DATE NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteFrais_pkey" PRIMARY KEY ("id")
);
