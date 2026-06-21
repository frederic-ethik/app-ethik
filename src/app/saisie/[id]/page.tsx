import { prisma } from "@/lib/prisma";
import SaisieForm from "@/components/SaisieForm";
import { heureDe } from "@/lib/format";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EditActivitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const [act, clients, types] = await Promise.all([
    prisma.activity.findUnique({ where: { id }, include: { client: true } }),
    prisma.client.findMany({ orderBy: [{ actif: "desc" }, { raisonSociale: "asc" }], select: { id: true, raisonSociale: true, actif: true } }),
    prisma.missionType.findMany({
      orderBy: [{ categorie: "asc" }, { objet: "asc" }],
      select: { id: true, clientId: true, categorie: true, objet: true, detail: true },
    }),
  ]);

  if (!act) notFound();

  // Session encore ouverte (badgeage en cours) → finalisation ; sinon → simple édition
  const finalize = act.finAct === null;
  const nextClientId = sp.next ?? "";
  const submitLabel = finalize && nextClientId ? "Enregistrer et démarrer la nouvelle activité" : undefined;

  const edit = {
    id: act.id,
    clientId: act.clientId,
    missionTypeId: act.missionTypeId ?? "",
    dateAct: act.dateAct.toISOString().slice(0, 10),
    debut: heureDe(act.debutAct),
    fin: act.finAct ? heureDe(act.finAct) : "",
    commentaire: act.commentaire ?? "",
  };

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Link href="/journal" style={{ fontSize: 13, color: "#0077a8", textDecoration: "none" }}>‹ Retour au journal</Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: "0 0 8px" }}>
        {finalize ? "Terminer l'activité" : "Modifier l'activité"}
      </h1>

      {finalize && (
        <div style={{ background: "#eef7e1", color: "#5f8e2a", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 18, maxWidth: 520 }}>
          ⏱ Le chronomètre <b>tourne toujours</b> (bandeau vert en haut). Indiquez le type de mission et ce que vous avez fait, puis validez — l&apos;heure de fin sera enregistrée à cet instant.
        </div>
      )}

      <div style={{ maxWidth: 520, background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "20px 22px" }}>
        <SaisieForm
          clients={clients}
          types={types}
          today={edit.dateAct}
          edit={edit}
          finalize={finalize}
          nextClientId={nextClientId}
          submitLabel={submitLabel}
        />
      </div>
    </>
  );
}
