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
  const pdf = await genererNoteFraisPdf(data);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="note-de-frais_${data.fichierSlug}.pdf"`,
    },
  });
}
