import { getRapportData } from "@/lib/rapport-data";
import { genererRapportPdf } from "@/components/RapportPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const client = url.searchParams.get("client") ?? "";
  const annee = Number(url.searchParams.get("annee"));
  const mois = Number(url.searchParams.get("mois"));
  if (!client || !annee || !mois) return new Response("Paramètres manquants", { status: 400 });

  const data = await getRapportData(client, annee, mois);
  const pdf = await genererRapportPdf(data);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport_${data.fichierSlug}.pdf"`,
    },
  });
}
