/**
 * Corrige les durées aberrantes créées en "terminant" d'anciennes sessions
 * (finAct fixé à aujourd'hui alors que l'activité datait de plusieurs années).
 * Toute activité de plus de 24 h est jugée incohérente : on la ré-clôture à
 * finAct = debutAct, dureeH = 0 (durée réellement inconnue).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const bogus = await prisma.activity.findMany({
    where: { dureeH: { gt: 24 } },
    include: { client: true },
    orderBy: { dureeH: "desc" },
  });
  console.log(`Activités avec durée > 24 h : ${bogus.length}`);
  for (const a of bogus) {
    console.log(`  N°${a.refAccess ?? "—"} · ${a.dateAct.toISOString().slice(0, 10)} · ${a.client.raisonSociale} · ${Math.round(a.dureeH)} h`);
  }

  if (bogus.length > 0) {
    const n = await prisma.$executeRaw`
      UPDATE "Activity"
      SET "finAct" = "debutAct", "dureeH" = 0, "updatedAt" = NOW()
      WHERE "dureeH" > 24`;
    console.log(`\nCorrigées : ${n}`);
  }

  const agg = await prisma.activity.aggregate({ _sum: { dureeH: true }, _max: { dureeH: true } });
  console.log(`\nVérif — heures totales : ${Math.round(agg._sum.dureeH ?? 0)} h · durée max d'une activité : ${agg._max.dureeH} h`);
}

main().finally(() => prisma.$disconnect());
