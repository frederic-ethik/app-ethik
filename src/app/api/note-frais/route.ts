import { prisma } from "@/lib/prisma";
import { getNoteFraisData } from "@/lib/note-frais-data";
import { genererNoteFraisPdf } from "@/components/NoteFraisPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const client = url.searchParams.get("client") ?? "";
  const debut = url.searchParams.get("debut") ?? "";
  const fin = url.searchParams.get("fin") ?? "";
  if (!debut || !fin) return new Response("Paramètres manquants", { status: 400 });

  const data = await getNoteFraisData(client, debut, fin);

  // « Génération » d'une note de frais = ce téléchargement PDF : on enregistre la note générée
  // et on estampille les déplacements inclus (pour l'alerte à l'édition ultérieure).
  if (data.deplacementIds.length > 0) {
    try {
      const note = await prisma.noteFrais.create({
        data: {
          clientId: client && client !== "tous" ? client : null,
          debut: new Date(`${debut}T00:00:00.000Z`),
          fin: new Date(`${fin}T00:00:00.000Z`),
          total: data.total,
        },
      });
      await prisma.deplacement.updateMany({
        where: { id: { in: data.deplacementIds } },
        data: { includedInNoteIds: { push: note.id } },
      });
    } catch {
      /* l'estampillage ne doit jamais empêcher le téléchargement du PDF */
    }
  }

  const pdf = await genererNoteFraisPdf(data);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="note-de-frais_${data.fichierSlug}.pdf"`,
    },
  });
}
