-- CreateEnum
CREATE TYPE "TypeClient" AS ENUM ('ESS_ASSO', 'ESS_SCOOP', 'SECTEUR_MARCHAND', 'NON_FACTURABLE', 'NON_FACTURE');

-- CreateEnum
CREATE TYPE "TypeFacturation" AS ENUM ('HORAIRE', 'REFACTURATION_REEL', 'NON_FACTURE');

-- CreateEnum
CREATE TYPE "Vehicule" AS ENUM ('NISSAN_ARIYA_3CV', 'VW_SHARAN_8CV');

-- CreateEnum
CREATE TYPE "MoyenPaiement" AS ENUM ('CARTE', 'ESPECES', 'CHEQUE', 'NC');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "refAccess" INTEGER,
    "raisonSociale" TEXT NOT NULL,
    "siret" TEXT,
    "typeClient" "TypeClient" NOT NULL,
    "adresse" TEXT,
    "codePostal" TEXT,
    "ville" TEXT,
    "contactNom" TEXT,
    "contactPrenom" TEXT,
    "contactTitre" TEXT,
    "contactEmail" TEXT,
    "contactTelephone" TEXT,
    "cibleJoursMensuelle" DOUBLE PRECISION,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "tokenAcces" TEXT,
    "accesActif" BOOLEAN NOT NULL DEFAULT false,
    "accesSynthese" BOOLEAN NOT NULL DEFAULT true,
    "accesTableau" BOOLEAN NOT NULL DEFAULT true,
    "accesDetail" BOOLEAN NOT NULL DEFAULT false,
    "accesJours" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionType" (
    "id" TEXT NOT NULL,
    "refAccess" INTEGER,
    "clientId" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "detail" TEXT,
    "typeFacturation" "TypeFacturation" NOT NULL DEFAULT 'NON_FACTURE',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "refAccess" INTEGER,
    "dateAct" DATE NOT NULL,
    "debutAct" TIMESTAMP(3) NOT NULL,
    "finAct" TIMESTAMP(3),
    "dureeH" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clientId" TEXT NOT NULL,
    "missionTypeId" TEXT,
    "commentaire" TEXT,
    "hasDeplacement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deplacement" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "dateDeplacement" DATE NOT NULL,
    "description" TEXT,
    "vehicule" "Vehicule",
    "lieuDepart" TEXT,
    "lieuArrivee" TEXT,
    "kmAller" DOUBLE PRECISION,
    "kmRetour" DOUBLE PRECISION,
    "kmTotal" DOUBLE PRECISION,
    "indemniteKm" DOUBLE PRECISION,
    "fraisTransport" DOUBLE PRECISION,
    "fraisParking" DOUBLE PRECISION,
    "fraisRepas" DOUBLE PRECISION,
    "fraisHotel" DOUBLE PRECISION,
    "fraisDivers" DOUBLE PRECISION,
    "totalFrais" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moyenPaiement" "MoyenPaiement",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Justificatif" (
    "id" TEXT NOT NULL,
    "deplacementId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nomFichier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Justificatif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportMensuel" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "joursValides" DOUBLE PRECISION,
    "syntheseValidee" TEXT,
    "syntheseValideAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RapportMensuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "baremeNissanAriya" JSONB NOT NULL,
    "baremeVwSharan" JSONB NOT NULL,
    "dureeJourneeH" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "seuilAlerteJours" INTEGER NOT NULL DEFAULT 7,
    "googleMapsApiKey" TEXT,
    "adresseDomicile" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "nomConsultant" TEXT DEFAULT 'Frédéric WOEHREL',
    "titreConsultant" TEXT DEFAULT 'Consultant',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_refAccess_key" ON "Client"("refAccess");

-- CreateIndex
CREATE UNIQUE INDEX "Client_tokenAcces_key" ON "Client"("tokenAcces");

-- CreateIndex
CREATE UNIQUE INDEX "MissionType_refAccess_key" ON "MissionType"("refAccess");

-- CreateIndex
CREATE INDEX "MissionType_clientId_idx" ON "MissionType"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_refAccess_key" ON "Activity"("refAccess");

-- CreateIndex
CREATE INDEX "Activity_clientId_idx" ON "Activity"("clientId");

-- CreateIndex
CREATE INDEX "Activity_dateAct_idx" ON "Activity"("dateAct");

-- CreateIndex
CREATE INDEX "Activity_missionTypeId_idx" ON "Activity"("missionTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Deplacement_activityId_key" ON "Deplacement"("activityId");

-- CreateIndex
CREATE INDEX "Justificatif_deplacementId_idx" ON "Justificatif"("deplacementId");

-- CreateIndex
CREATE UNIQUE INDEX "RapportMensuel_clientId_annee_mois_key" ON "RapportMensuel"("clientId", "annee", "mois");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "MissionType" ADD CONSTRAINT "MissionType_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_missionTypeId_fkey" FOREIGN KEY ("missionTypeId") REFERENCES "MissionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deplacement" ADD CONSTRAINT "Deplacement_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Justificatif" ADD CONSTRAINT "Justificatif_deplacementId_fkey" FOREIGN KEY ("deplacementId") REFERENCES "Deplacement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportMensuel" ADD CONSTRAINT "RapportMensuel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
