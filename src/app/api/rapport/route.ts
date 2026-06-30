import { getRapportData, getRapportPeriodeData } from "@/lib/rapport-data";
import { genererRapportPdf } from "@/components/RapportPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pdfResponse(pdf: Buffer, slug: string) {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport_${slug}.pdf"`,
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const client = url.searchParams.get("client") ?? "";
  if (!client) return new Response("Paramètres manquants", { status: 400 });

  const debut = url.searchParams.get("debut");
  const fin = url.searchParams.get("fin");
  if (debut && fin) {
    // Mode période (date à date) — sans synthèse (lien direct, lecture seule).
    const data = await getRapportPeriodeData(client, debut, fin);
    return pdfResponse(await genererRapportPdf(data), data.fichierSlug);
  }

  const annee = Number(url.searchParams.get("annee"));
  const mois = Number(url.searchParams.get("mois"));
  if (!annee || !mois) return new Response("Paramètres manquants", { status: 400 });
  const data = await getRapportData(client, annee, mois);
  return pdfResponse(await genererRapportPdf(data), data.fichierSlug);
}

// Mode période (date à date) : la synthèse éditée à l'écran est transmise dans le corps.
export async function POST(req: Request) {
  const form = await req.formData();
  const client = String(form.get("client") ?? "");
  const debut = String(form.get("debut") ?? "");
  const fin = String(form.get("fin") ?? "");
  const synthese = String(form.get("synthese") ?? "");
  if (!client || !debut || !fin) return new Response("Paramètres manquants", { status: 400 });

  const data = await getRapportPeriodeData(client, debut, fin, synthese);
  const pdf = await genererRapportPdf(data);
  return pdfResponse(pdf, data.fichierSlug);
}
