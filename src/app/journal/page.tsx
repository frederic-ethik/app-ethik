import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MOIS, JOURS, formatHeuresCourt, heureDe } from "@/lib/format";
import { supprimerActivite } from "@/app/actions";

export const dynamic = "force-dynamic";

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; mois?: string; debut?: string; fin?: string; ok?: string; encours?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const defDebut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defFin = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

  // Filtre par plage de dates (date à date). Rétrocompat : ?mois=YYYY-MM → mois entier.
  let dISO = sp.debut;
  let fISO = sp.fin;
  if (!dISO && !fISO && sp.mois && /^\d{4}-\d{2}$/.test(sp.mois)) {
    const [my, mm] = sp.mois.split("-").map(Number);
    dISO = `${sp.mois}-01`;
    fISO = isoDate(new Date(Date.UTC(my, mm, 0)));
  }
  const parseISO = (s: string | undefined, fb: Date) =>
    s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : fb;
  let debutDate = parseISO(dISO, defDebut);
  let finDate = parseISO(fISO, defFin);
  if (debutDate > finDate) [debutDate, finDate] = [finDate, debutDate];
  const debutISO = isoDate(debutDate);
  const finISO = isoDate(finDate);
  const finExclusive = new Date(finDate);
  finExclusive.setUTCDate(finExclusive.getUTCDate() + 1);
  const clientId = sp.client || "";

  const [clients, acts] = await Promise.all([
    prisma.client.findMany({ orderBy: [{ actif: "desc" }, { raisonSociale: "asc" }], select: { id: true, raisonSociale: true, actif: true } }),
    prisma.activity.findMany({
      where: { dateAct: { gte: debutDate, lt: finExclusive }, ...(clientId ? { clientId } : {}) },
      include: { client: true, missionType: true, deplacement: { select: { id: true, totalFrais: true } } },
      orderBy: [{ dateAct: "desc" }, { debutAct: "desc" }],
    }),
  ]);

  // Querystring du filtre courant, propagé aux pages d'édition pour revenir au même filtre.
  const filtreParams = new URLSearchParams();
  if (clientId) filtreParams.set("client", clientId);
  filtreParams.set("debut", debutISO);
  filtreParams.set("fin", finISO);
  const retourQS = encodeURIComponent(`/journal?${filtreParams.toString()}`);

  // Raccourci mois précédent / suivant : cale sur un mois calendaire complet, basé sur le mois du « Du ».
  const refIdx = debutDate.getUTCFullYear() * 12 + debutDate.getUTCMonth();
  const refY = Math.floor(refIdx / 12);
  const refM = refIdx % 12;
  const moisHref = (idx: number) => {
    const y = Math.floor(idx / 12);
    const m0 = ((idx % 12) + 12) % 12;
    const p = new URLSearchParams();
    if (clientId) p.set("client", clientId);
    p.set("debut", isoDate(new Date(Date.UTC(y, m0, 1))));
    p.set("fin", isoDate(new Date(Date.UTC(y, m0 + 1, 0))));
    return `/journal?${p.toString()}`;
  };

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
  const navArrow = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 36, borderRadius: 6, textDecoration: "none", color: "#7F7F7F", fontSize: 18, border: "1px solid rgba(0,0,0,.12)", background: "#fff" } as const;

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: 0 }}>Journal des activités</h1>
        <span style={{ fontSize: 13, color: "#7F7F7F" }}>Total de la période : <b style={{ color: "#595959" }}>{formatHeuresCourt(totalMois)}</b> · {acts.length} activités</span>
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
          <label style={label}>Du</label>
          <input type="date" name="debut" defaultValue={debutISO} style={field} />
        </div>
        <div>
          <label style={label}>Au</label>
          <input type="date" name="fin" defaultValue={finISO} style={field} />
        </div>
        <div>
          <label style={label}>Client</label>
          <select name="client" defaultValue={clientId} style={field}>
            <option value="">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.raisonSociale}{c.actif ? "" : " (archivé)"}</option>
            ))}
          </select>
        </div>
        <button type="submit" style={{ ...field, cursor: "pointer", background: "#fff" }}>Filtrer</button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
          <Link href={moisHref(refIdx - 1)} title="Mois précédent" aria-label="Mois précédent" style={navArrow}>‹</Link>
          <Link href={moisHref(refIdx)} title="Voir tout ce mois" style={{ fontSize: 13, fontWeight: 600, color: "#0077a8", textDecoration: "none", minWidth: 96, textAlign: "center" }}>{MOIS[refM]} {refY}</Link>
          <Link href={moisHref(refIdx + 1)} title="Mois suivant" aria-label="Mois suivant" style={navArrow}>›</Link>
        </div>
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
                          {!enCours && (a.hasDeplacement || a.deplacement) && (
                            a.deplacement ? (
                              <Link href={`/deplacement/${a.id}?retour=${retourQS}`} title="Déplacement rattaché — modifier" style={{ color: "#00B0F0", fontSize: 12, textDecoration: "none" }}>
                                🚗 {a.deplacement.totalFrais.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                              </Link>
                            ) : (
                              <Link href={`/deplacement/${a.id}?retour=${retourQS}`} title="Saisir les frais de déplacement" style={{ color: "#e8a13a", fontSize: 13, textDecoration: "none" }}>🚗 à compléter</Link>
                            )
                          )}
                          {!enCours && (
                            <Link href={`/saisie/${a.id}?retour=${retourQS}`} title="Modifier l'activité" style={{ color: "#0077a8", fontSize: 14, textDecoration: "none" }}>✎</Link>
                          )}
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
