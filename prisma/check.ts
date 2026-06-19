/** Vérification rapide du contenu de la base après migration. */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [clients, types, activities, sum] = await Promise.all([
    prisma.client.count(),
    prisma.missionType.count(),
    prisma.activity.count(),
    prisma.activity.aggregate({ _sum: { dureeH: true } }),
  ]);
  console.log(
    `Clients: ${clients} | Types: ${types} | Activités: ${activities} | Heures totales: ${Math.round(sum._sum.dureeH ?? 0)} h`
  );
  const top = await prisma.client.findMany({
    select: {
      raisonSociale: true,
      typeClient: true,
      actif: true,
      _count: { select: { activities: true } },
    },
    orderBy: { activities: { _count: "desc" } },
    take: 6,
  });
  console.log("\nTop clients par volume d'activités :");
  for (const c of top) {
    console.log(
      ` - ${c.raisonSociale} [${c.typeClient}]${c.actif ? "" : " (archivé)"} : ${c._count.activities} activités`
    );
  }
}

main().finally(() => prisma.$disconnect());
