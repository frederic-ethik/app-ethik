-- CreateTable
CREATE TABLE "AccesVue" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moisVu" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AccesVue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccesVue_clientId_viewedAt_idx" ON "AccesVue"("clientId", "viewedAt");

-- AddForeignKey
ALTER TABLE "AccesVue" ADD CONSTRAINT "AccesVue_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
