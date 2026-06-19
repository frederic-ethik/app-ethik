/**
 * Script de migration unique Access -> PostgreSQL (Neon).
 * Idempotent : peut être relancé sans créer de doublons (upsert sur refAccess).
 * Source : prisma/access-data.json (exporté depuis Suivi_Act.accdb).
 *
 * Lancer :  npx tsx prisma/migrate-access.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type AccessData = {
  clients: any[];
  types: any[];
  activities: any[];
};

const TYPE_CLIENT: Record<string, string> = {
  "ESS - Asso": "ESS_ASSO",
  "ESS - SCoop": "ESS_SCOOP",
  "Secteur marchand": "SECTEUR_MARCHAND",
  "Autre non facturable": "NON_FACTURABLE",
  "Autre non facturé": "NON_FACTURE",
};

function mapTypeClient(v: string | null): string {
  if (v && TYPE_CLIENT[v]) return TYPE_CLIENT[v];
  return "NON_FACTURABLE";
}

function mapFacturation(v: string | null): string {
  if (!v) return "NON_FACTURE";
  const s = v.toLowerCase();
  if (s.includes("horaire")) return "HORAIRE";
  if (s.includes("refactur")) return "REFACTURATION_REEL";
  return "NON_FACTURE";
}

function dureeHours(debut: string | null, fin: string | null): number {
  if (!debut || !fin) return 0;
  const [dh, dm] = debut.split(":").map(Number);
  const [fh, fm] = fin.split(":").map(Number);
  let mins = fh * 60 + fm - (dh * 60 + dm);
  if (mins < 0) mins += 1440; // sécurité si passage minuit
  return Math.round((mins / 60) * 100) / 100;
}

// Barème kilométrique URSSAF officiel 2026 (tranches 5000/20000 km)
const BAREME_NISSAN = {
  puissanceFiscale: "3CV",
  electrique: true,
  majoration: 0.2, // +20 % véhicule 100 % électrique
  tranches: [
    { max: 5000, taux: 0.529, constante: 0 },
    { max: 20000, taux: 0.316, constante: 1065 },
    { max: null, taux: 0.37, constante: 0 },
  ],
};
const BAREME_VW = {
  puissanceFiscale: "8CV", // barème "7 CV et plus"
  electrique: false,
  majoration: 0,
  tranches: [
    { max: 5000, taux: 0.697, constante: 0 },
    { max: 20000, taux: 0.394, constante: 1515 },
    { max: null, taux: 0.47, constante: 0 },
  ],
};

async function main() {
  const data: AccessData = JSON.parse(
    readFileSync(join(process.cwd(), "prisma", "access-data.json"), "utf-8")
  );

  // 1) Réglages (ligne unique) + barèmes URSSAF
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { baremeNissanAriya: BAREME_NISSAN, baremeVwSharan: BAREME_VW },
    create: {
      id: "singleton",
      baremeNissanAriya: BAREME_NISSAN,
      baremeVwSharan: BAREME_VW,
      dureeJourneeH: 7,
      seuilAlerteJours: 7,
      adresseDomicile: "59 Grand Rue, 67350 Niedermodern",
      nomConsultant: "Frédéric WOEHREL",
      titreConsultant: "Consultant",
    },
  });
  console.log("Réglages + barèmes URSSAF : OK");

  // 2) Clients
  const clientMap: Record<number, string> = {};
  for (const c of data.clients) {
    const payload = {
      raisonSociale: c.raisonSociale ?? "(sans nom)",
      siret: c.siret ?? null,
      typeClient: mapTypeClient(c.type) as any,
      adresse: c.adresse ?? null,
      codePostal: c.cp != null ? String(c.cp) : null,
      ville: c.ville ?? null,
      contactNom: c.nom ?? null,
      contactPrenom: c.prenom ?? null,
      contactTitre: c.titre ?? null,
      actif: !!c.actif,
    };
    const rec = await prisma.client.upsert({
      where: { refAccess: c.ref },
      update: payload,
      create: { refAccess: c.ref, ...payload },
    });
    clientMap[c.ref] = rec.id;
  }
  console.log(`Clients : ${Object.keys(clientMap).length}`);

  // 3) Types de missions
  const typeMap: Record<number, string> = {};
  let typesSkipped = 0;
  for (const t of data.types) {
    const clientId = clientMap[t.clientRef];
    if (!clientId) {
      typesSkipped++;
      continue;
    }
    const payload = {
      clientId,
      categorie: t.categorie ?? "(non précisé)",
      objet: t.objet ?? "(non précisé)",
      detail: t.detail ?? null,
      typeFacturation: mapFacturation(t.typeFact) as any,
      actif: !t.old, // OLD = archivé
    };
    const rec = await prisma.missionType.upsert({
      where: { refAccess: t.ref },
      update: payload,
      create: { refAccess: t.ref, ...payload },
    });
    typeMap[t.ref] = rec.id;
  }
  console.log(`Types de missions : ${Object.keys(typeMap).length} (ignorés sans client : ${typesSkipped})`);

  // 4) Activités (createMany par lots, idempotent via skipDuplicates sur refAccess)
  const rows: any[] = [];
  let actsSkipped = 0;
  let sansType = 0;
  for (const a of data.activities) {
    const clientId = clientMap[a.clientRef];
    if (!clientId || !a.dateAct) {
      actsSkipped++;
      continue;
    }
    const missionTypeId = a.categorieRef ? typeMap[a.categorieRef] ?? null : null;
    if (!missionTypeId) sansType++;
    const debut = a.debut ?? "00:00";
    rows.push({
      refAccess: a.ref,
      dateAct: new Date(`${a.dateAct}T00:00:00.000Z`),
      debutAct: new Date(`${a.dateAct}T${debut}:00.000Z`),
      finAct: a.fin ? new Date(`${a.dateAct}T${a.fin}:00.000Z`) : null,
      dureeH: dureeHours(a.debut, a.fin),
      clientId,
      missionTypeId,
      commentaire: a.commentaire ?? null,
      hasDeplacement: false,
    });
  }

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const res = await prisma.activity.createMany({ data: batch, skipDuplicates: true });
    inserted += res.count;
    process.stdout.write(`  activités importées : ${inserted}\r`);
  }
  console.log(`\nActivités : ${inserted} importées (${actsSkipped} ignorées, ${sansType} sans type de mission)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Migration terminée ✅");
  })
  .catch(async (e) => {
    console.error("Erreur de migration :", e);
    await prisma.$disconnect();
    process.exit(1);
  });
