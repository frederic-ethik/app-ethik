-- CreateEnum
CREATE TYPE "AccesType" AS ENUM ('MENSUEL', 'MISSION');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "accesType" "AccesType" NOT NULL DEFAULT 'MENSUEL',
ADD COLUMN     "missionDebut" DATE,
ADD COLUMN     "missionFin" DATE,
ADD COLUMN     "missionSynthese" TEXT,
ADD COLUMN     "missionSyntheseAt" TIMESTAMP(3);
