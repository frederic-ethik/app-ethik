import { prisma } from "@/lib/prisma";
import { MOIS, JOURS, formatHeuresCourt, heureDe } from "@/lib/format";
import { supprimerActivite } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; mois?: string; ok?: string; encours?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const moisStr = sp.mois || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [annee, moisNum] = moisStr.split("-").map(Number);
  const debutMois = new Date(Date.UTC(annee, moisNum - 1, 1));
  const finMois = new Date(Date.UTC(annee, moisNum, 1));
  const clientId = sp.client || "";

  const [clients, acts] = await Promise.all([
    prisma.client.findMany({ orderBy: { raisonSociale: "asc" }, select: { id: true, raisonSociale: true } }),
    prisma.activity.findMany({
      where: { dateAct: { gte: debutMois, lt: finMois }, ...(clientId ? { clientId } : {}) },
      include: { client: true, missionType: true, deplacement: { select: { id: true } } },
      orderBy: [{ dateAct: "desc" }, { debutAct: "desc" }],
    }),
  ]);

  // Regroupement par jour
  const jours: { key: string; date: Date; items: typeof acts }[] = [];
  for (const a of acts) {
    const key = a.dateAct.toISOString().slice(0, 10);
    let g = jours.find((j) => j.key === key);
    if (!g) {
      g = { key, date: a.dateAct, items: [] };
      jours.push(g);
    }
    g.items.push(a);
  }
  const totalMois = acts.reduce((s, a) => s + a.dureeH, 0);

  const label = { fontSize: 12, color: "#7F7F7F", marginBottom: 3, display: "block" } as const;
  const field = { fontSize: 14, padding: "8px 10px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8, background: "#fff", color: "#595959" } as const;

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: 0 }}>Journal des activités</h1>
        <span style={{ fontSize: 13, color: "#7F7F7F" }}>Total du mois : <b style={{ color: "#595959" }}>{formatHeuresCourt(totalMois)}</b> · {acts.length} activités</span>
      </div>

      {sp.ok && (
        <div style={{ background: "#eef7e1", color: "#5f8e2a", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          ✓ Activité enregistrée.
        </div>
      )}
      {sp.encours && (
        <div style={{ background: "#fff6e0", color: "#997300", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          Une session de badgeage est déjà en cours — terminez-la avant d&apos;en démarrer une autre.
        </div>
      )}

      {/* Filtres */}
      <form method="get" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <label style={label}>Mois</label>
          <input type="month" name="mois" defaultValue={moisStr} style={field} />
        </div>
        <div>
          <label style={label}>Client</label>
          <select name="client" defaultValue={clientId} style={field}>
            <option value="">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.raisonSociale}</option>
            ))}
          </select>
        </div>
        <button type="submit" style={{ ...field, cursor: "pointer", background: "#fff" }}>Filtrer</button>
      </form>

      {jours.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: 24, textAlign: "center", color: "#7F7F7F", fontSize: 14 }}>
          Aucune activité pour cette période.
        </div>
      ) : (
        jours.map((j) => {
          const totalJour = j.items.reduce((s, a) => s + a.dureeH, 0);
          return (
            <section key={j.key} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#595959", margin: 0 }}>
                  {JOURS[j.date.getUTCDay()]} {j.date.getUTCDate()} {MOIS[j.date.getUTCMonth()]}
                </h2>
                <span style={{ fontSize: 12, color: "#7F7F7F" }}>Total {formatHeuresCourt(totalJour)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {j.items.map((a) => {
                  const enCours = !a.finAct;
                  return (
                    <div key={a.id} style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 10, padding: "11px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {heureDe(a.debutAct)}{a.finAct ? `–${heureDe(a.finAct)}` : ""} ·{" "}
                          {enCours ? <span style={{ color: "#5f8e2a" }}>en cours…</span> : formatHeuresCourt(a.dureeH)}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {a.deplacement && <span title="Déplacement rattaché" style={{ color: "#00B0F0", fontSize: 13 }}>🚗</span>}
                          {!enCours && (
                            <form action={supprimerActivite}>
                              <input type="hidden" name="id" value={a.id} />
                              <button type="submit" title="Supprimer" style={{ border: "none", background: "transparent", color: "#a5a5a5", cursor: "pointer", fontSize: 13 }}>✕</button>
                            </form>
                          )}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#7F7F7F", marginTop: 2 }}>
                        {a.client.raisonSociale}
                        {a.missionType ? ` · ${a.missionType.categorie} › ${a.missionType.objet}` : ""}
                      </div>
                      {a.commentaire && (
                        <div style={{ fontSize: 12, color: "#a5a5a5", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.commentaire}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
