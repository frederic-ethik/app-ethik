/**
 * Maintenance ponctuelle : clôture les activités héritées de la migration Access
 * qui n'avaient pas d'heure de fin (et donc apparaissaient comme "sessions en cours").
 * On fixe finAct = debutAct et dureeH = 0 (durée réellement inconnue côté Access).
 * Idempotent : relançable sans effet s'il n'y a plus de session ouverte.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const avant = await prisma.activity.count({ where: { finAct: null } });
  console.log(`Sessions ouvertes avant : ${avant}`);

  const n = await prisma.$executeRaw`
    UPDATE "Activity"
    SET "finAct" = "debutAct", "dureeH" = 0, "updatedAt" = NOW()
    WHERE "finAct" IS NULL`;
  console.log(`Lignes clôturées : ${n}`);

  const apres = await prisma.activity.count({ where: { finAct: null } });
  console.log(`Sessions ouvertes après : ${apres}`);
}

main().finally(() => prisma.$disconnect());
