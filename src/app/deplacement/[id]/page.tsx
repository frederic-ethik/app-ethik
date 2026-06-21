import { prisma } from "@/lib/prisma";
import DeplacementForm from "@/components/DeplacementForm";
import { supprimerDeplacement } from "@/app/actions";
import { heureDe } from "@/lib/format";
import type { Bareme } from "@/lib/bareme";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DeplacementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [act, settings] = await Promise.all([
    prisma.activity.findUnique({ where: { id }, include: { client: true, missionType: true, deplacement: true } }),
    prisma.settings.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!act) notFound();

  const d = act.deplacement;
  const annee = act.dateAct.getUTCFullYear();
  const debut = new Date(Date.UTC(annee, 0, 1));
  const fin = new Date(Date.UTC(annee + 1, 0, 1));
  const [aggAriya, aggSharan] = await Promise.all([
    prisma.deplacement.aggregate({ _sum: { kmTotal: true }, where: { vehicule: "NISSAN_ARIYA_3CV", dateDeplacement: { gte: debut, lt: fin }, NOT: { activityId: id } } }),
    prisma.deplacement.aggregate({ _sum: { kmTotal: true }, where: { vehicule: "VW_SHARAN_8CV", dateDeplacement: { gte: debut, lt: fin }, NOT: { activityId: id } } }),
  ]);

  const baremes = {
    NISSAN_ARIYA_3CV: settings?.baremeNissanAriya as unknown as Bareme,
    VW_SHARAN_8CV: settings?.baremeVwSharan as unknown as Bareme,
  };
  const cumul = {
    NISSAN_ARIYA_3CV: aggAriya._sum.kmTotal ?? 0,
    VW_SHARAN_8CV: aggSharan._sum.kmTotal ?? 0,
  };

  const str = (n: number | null | undefined) => (n == null ? "" : String(n));
  const init = {
    date: (d?.dateDeplacement ?? act.dateAct).toISOString().slice(0, 10),
    description: d?.description ?? "",
    vehicule: (d?.vehicule ?? "") as "" | "NISSAN_ARIYA_3CV" | "VW_SHARAN_8CV",
    lieuDepart: d?.lieuDepart ?? (d ? "" : settings?.adresseDomicile ?? ""),
    lieuArrivee: d?.lieuArrivee ?? "",
    kmAller: str(d?.kmAller),
    kmRetour: str(d?.kmRetour),
    fraisTransport: str(d?.fraisTransport),
    fraisParking: str(d?.fraisParking),
    fraisRepas: str(d?.fraisRepas),
    fraisHotel: str(d?.fraisHotel),
    fraisDivers: str(d?.fraisDivers),
    moyenPaiement: d?.moyenPaiement ?? "",
  };

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Link href="/journal" style={{ fontSize: 13, color: "#0077a8", textDecoration: "none" }}>‹ Retour au journal</Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: "0 0 4px" }}>
        {d ? "Modifier le déplacement" : "Ajouter un déplacement"}
      </h1>
      <p style={{ fontSize: 13, color: "#7F7F7F", margin: "0 0 20px" }}>
        Rattaché à : {act.dateAct.toLocaleDateString("fr-FR")} · {heureDe(act.debutAct)}{act.finAct ? `–${heureDe(act.finAct)}` : ""} · {act.client.raisonSociale}
        {act.missionType ? ` · ${act.missionType.categorie}` : ""}
      </p>

      <div style={{ maxWidth: 560, background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "20px 22px" }}>
        <DeplacementForm activityId={id} init={init} baremes={baremes} cumul={cumul} />
      </div>

      {d && (
        <form action={supprimerDeplacement} style={{ marginTop: 14 }}>
          <input type="hidden" name="activityId" value={id} />
          <button type="submit" style={{ fontSize: 13, padding: "8px 13px", borderRadius: 8, border: "1px solid rgba(0,0,0,.2)", background: "#fff", color: "#a32d2d", cursor: "pointer" }}>
            Supprimer ce déplacement
          </button>
        </form>
      )}
    </>
  );
}
