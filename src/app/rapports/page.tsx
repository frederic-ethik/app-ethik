import { prisma } from "@/lib/prisma";
import { MOIS, formatHM, formatHeuresCourt, heureDe } from "@/lib/format";
import { validerJoursRapport, genererSynthese } from "@/app/actions";
import RapportNav from "@/components/RapportNav";
import SyntheseTable from "@/components/SyntheseTable";
import SyntheseClient from "@/components/SyntheseClient";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");

const TYPE_LABEL: Record<string, string> = {
  ESS_ASSO: "ESS · Association",
  ESS_SCOOP: "ESS · SCOP",
  SECTEUR_MARCHAND: "Secteur marchand",
  NON_FACTURABLE: "Non facturable",
  NON_FACTURE: "Non facturé",
};

const toIdx = (y: number, m0: number) => y * 12 + m0;
const idxToKey = (idx: number) => `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; mois?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const currentIdx = toIdx(now.getUTCFullYear(), now.getUTCMonth());

  const clients = await prisma.client.findMany({
    orderBy: { raisonSociale: "asc" },
    select: { id: true, raisonSociale: true, typeClient: true, cibleJoursMensuelle: true, actif: true },
  });
  const clientId = sp.client || clients.find((c) => c.actif)?.id || clients[0]?.id;
  const client = clients.find((c) => c.id === clientId);

  const [acts, rapports, settings] = await Promise.all([
    client
      ? prisma.activity.findMany({ where: { clientId }, include: { missionType: true }, orderBy: [{ dateAct: "asc" }, { debutAct: "asc" }] })
      : Promise.resolve([]),
    client ? prisma.rapportMensuel.findMany({ where: { clientId } }) : Promise.resolve([]),
    prisma.settings.findUnique({ where: { id: "singleton" } }),
  ]);

  const factMap = new Map<string, number | null>(rapports.map((r) => [`${r.annee}-${pad(r.mois)}`, r.joursValides]));

  // Pivot sur TOUT l'historique (pour la moyenne mensuelle stable)
  type Row = { cat: string; obj: string; key: string; per: Record<string, number>; total: number };
  const rowsMap = new Map<string, Row>();
  const monthTotal: Record<string, number> = {};
  const monthDays: Record<string, Set<string>> = {};
  for (const a of acts) {
    const mk = `${a.dateAct.getUTCFullYear()}-${pad(a.dateAct.getUTCMonth() + 1)}`;
    const tk = a.missionTypeId ?? "—";
    let row = rowsMap.get(tk);
    if (!row) {
      row = { cat: a.missionType?.categorie ?? "(sans type)", obj: a.missionType?.objet ?? "—", key: tk, per: {}, total: 0 };
      rowsMap.set(tk, row);
    }
    row.per[mk] = (row.per[mk] ?? 0) + a.dureeH;
    row.total += a.dureeH;
    monthTotal[mk] = (monthTotal[mk] ?? 0) + a.dureeH;
    (monthDays[mk] ??= new Set()).add(a.dateAct.toISOString().slice(0, 10));
  }
  const rows = [...rowsMap.values()].sort((x, y) => x.cat.localeCompare(y.cat) || x.obj.localeCompare(y.obj));
  const activeMonths = Object.values(monthTotal).filter((t) => t > 0).length || 1;

  // Plage de mois du client (barre de navigation : du plus ancien au plus récent)
  const times = acts.map((a) => a.dateAct.getTime());
  const firstIdx = acts.length ? toIdx(new Date(Math.min(...times)).getUTCFullYear(), new Date(Math.min(...times)).getUTCMonth()) : currentIdx;
  const lastIdx = acts.length ? toIdx(new Date(Math.max(...times)).getUTCFullYear(), new Date(Math.max(...times)).getUTCMonth()) : currentIdx;
  const sliderMin = Math.min(firstIdx, currentIdx);
  const sliderMax = currentIdx;

  const requested = sp.mois || idxToKey(lastIdx);
  const [reqY, reqM] = requested.split("-").map(Number);
  const focusIdx = Math.min(Math.max(toIdx(reqY, reqM - 1), sliderMin), sliderMax);
  const selY = Math.floor(focusIdx / 12);
  const selM = (focusIdx % 12) + 1;
  const selKey = idxToKey(focusIdx);
  const moisStr = selKey;

  // Tous les mois du focus vers le plus ancien (anti-chrono) — le composant client
  // affichera autant de colonnes que la largeur le permet.
  const allMonths = Array.from({ length: Math.min(focusIdx - sliderMin + 1, 60) }, (_, i) => {
    const idx = focusIdx - i;
    return { key: idxToKey(idx), label: `${MOIS[idx % 12].slice(0, 4)} ${String(Math.floor(idx / 12)).slice(2)}` };
  });
  const rowsData = rows.map((r) => ({ key: r.key, cat: r.cat, obj: r.obj, moy: r.total / activeMonths, per: allMonths.map((mm) => r.per[mm.key] ?? 0) }));
  const totalRow = allMonths.map((mm) => monthTotal[mm.key] ?? 0);
  const facturesRow = allMonths.map((mm) => factMap.get(mm.key) ?? null);
  const joursRow = allMonths.map((mm) => monthDays[mm.key]?.size ?? 0);
  const moyTotal = rows.reduce((s, r) => s + r.total, 0) / activeMonths;

  // Indicateurs du mois sélectionné (focus)
  const totalSel = monthTotal[selKey] ?? 0;
  const joursIndic = monthDays[selKey]?.size ?? 0;
  const joursFactures = factMap.get(selKey) ?? null;
  const moyFacturee = joursFactures ? totalSel / joursFactures : null;
  const synthese = rapports.find((r) => r.annee === selY && r.mois === selM)?.syntheseValidee ?? "";
  const detail = acts.filter((a) => `${a.dateAct.getUTCFullYear()}-${pad(a.dateAct.getUTCMonth() + 1)}` === selKey);

  const field = { fontSize: 14, padding: "8px 10px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8, background: "#fff", color: "#595959" } as const;
  const card = { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "18px 20px", marginBottom: 22 } as const;
  const partTitle = { fontSize: 11, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#a5a5a5", margin: "0 0 8px" };
  const stickyLeft = { position: "sticky" as const, left: 0, background: "#fff" };

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: "0 0 14px" }}>Rapport mensuel client</h1>

      <form method="get" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 3 }}>Client</label>
          <select name="client" defaultValue={clientId} style={{ ...field, minWidth: 230 }}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.raisonSociale}{c.actif ? "" : " (archivé)"}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 3 }}>Mois (le plus récent affiché)</label>
          <input type="month" name="mois" defaultValue={moisStr} style={field} />
        </div>
        <button type="submit" style={{ ...field, cursor: "pointer" }}>Afficher</button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#a5a5a5" }}>PDF / Excel — à venir</span>
      </form>

      {!client ? (
        <div style={card}>Aucun client.</div>
      ) : (
        <>
          <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{client.raisonSociale}</div>
              <div style={{ fontSize: 12, color: "#7F7F7F" }}>
                {MOIS[selM - 1]} {selY}{client.cibleJoursMensuelle ? ` · cible ${client.cibleJoursMensuelle} j/mois` : ""}
              </div>
            </div>
            <span style={{ fontSize: 12, padding: "4px 11px", borderRadius: 12, background: "#e0f5fe", color: "#0077a8" }}>
              {TYPE_LABEL[client.typeClient] ?? client.typeClient}
            </span>
          </div>

          {/* Partie A — Tableau de synthèse (6 mois, anti-chronologique) */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <p style={{ ...partTitle, margin: 0 }}>A · Tableau de synthèse</p>
              <div style={{ flex: 1, maxWidth: 420, minWidth: 240 }}>
                <RapportNav clientId={clientId!} min={sliderMin} max={sliderMax} value={focusIdx} />
              </div>
            </div>

            <SyntheseTable
              selKey={selKey}
              months={allMonths}
              rows={rowsData}
              totalRow={totalRow}
              facturesRow={facturesRow}
              joursRow={joursRow}
              moyTotal={moyTotal}
            />
            <p style={{ fontSize: 11, color: "#a5a5a5", margin: "10px 0 0" }}>
              « Jours travaillés (indicatif) » = jours distincts avec activité (aide au calcul). Ce sont les « Jours facturés » qui font foi — modifiez-les ci-dessous (sélectionnez le mois voulu).
            </p>
          </div>

          {/* Facturation du mois sélectionné — jours réellement facturés (mémorisés) */}
          <div style={{ ...card, background: "#fff6e0", borderColor: "#FFC000" }}>
            <p style={partTitle}>Facturation — {MOIS[selM - 1]} {selY}</p>
            {sp.saved && (
              <div style={{ background: "#eef7e1", color: "#5f8e2a", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
                ✓ Jours facturés enregistrés.
              </div>
            )}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div><div style={{ fontSize: 12, color: "#997300" }}>Total heures</div><div style={{ fontSize: 18, fontWeight: 600 }}>{formatHeuresCourt(totalSel)}</div></div>
              <div><div style={{ fontSize: 12, color: "#a5a5a5" }}>Jours travaillés (indicatif)</div><div style={{ fontSize: 18, fontWeight: 600, color: "#a5a5a5" }}>{joursIndic} j</div></div>
              <form action={validerJoursRapport} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="annee" value={selY} />
                <input type="hidden" name="mois" value={selM} />
                <div>
                  <label style={{ fontSize: 12, color: "#5f8e2a", display: "block", marginBottom: 3, fontWeight: 600 }}>Jours facturés (réel) ✎</label>
                  <input name="joursValides" defaultValue={joursFactures ?? ""} placeholder="—" style={{ ...field, width: 100, borderColor: "#92D050" }} />
                </div>
                <button type="submit" style={{ ...field, cursor: "pointer", background: "linear-gradient(90deg,#92D050,#7cbf3f)", color: "#fff", border: "none" }}>Enregistrer</button>
              </form>
              <div><div style={{ fontSize: 12, color: "#997300" }}>Moyenne / jour facturé</div><div style={{ fontSize: 18, fontWeight: 600 }}>{moyFacturee ? formatHM(moyFacturee) : "—"}</div></div>
            </div>
          </div>

          {/* Partie B — Détail des activités du mois sélectionné */}
          <div style={card}>
            <p style={partTitle}>B · Détail des activités — {MOIS[selM - 1]} {selY}</p>
            {detail.length === 0 ? (
              <p style={{ fontSize: 14, color: "#a5a5a5" }}>Aucune activité ce mois-ci.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "#7F7F7F", textAlign: "left" }}>
                    <th style={{ padding: "6px 6px", fontWeight: 600 }}>Date</th>
                    <th style={{ padding: "6px 6px", fontWeight: 600 }}>Horaire</th>
                    <th style={{ padding: "6px 6px", fontWeight: 600 }}>Catégorie › Objet</th>
                    <th style={{ padding: "6px 6px", fontWeight: 600 }}>Commentaire</th>
                    <th style={{ padding: "6px 6px", fontWeight: 600, textAlign: "right" }}>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.map((a) => (
                    <tr key={a.id} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                      <td style={{ padding: "6px 6px" }}>{a.dateAct.toLocaleDateString("fr-FR")}</td>
                      <td style={{ padding: "6px 6px" }}>{heureDe(a.debutAct)}{a.finAct ? `–${heureDe(a.finAct)}` : ""}</td>
                      <td style={{ padding: "6px 6px" }}>{a.missionType ? `${a.missionType.categorie} › ${a.missionType.objet}` : "—"}</td>
                      <td style={{ padding: "6px 6px", color: "#7F7F7F" }}>{a.commentaire ?? ""}</td>
                      <td style={{ padding: "6px 6px", textAlign: "right" }}>{formatHeuresCourt(a.dureeH)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 600 }}>
                    <td colSpan={4} style={{ padding: "8px 6px" }}>Total</td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}>{formatHeuresCourt(totalSel)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Partie C — Synthèse rédigée par l'IA */}
          <div style={card}>
            <p style={partTitle}>C · Synthèse rédigée par l&apos;IA (Claude)</p>
            {synthese ? (
              <SyntheseClient clientId={clientId!} annee={selY} mois={selM} initial={synthese} />
            ) : (
              <form action={genererSynthese}>
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="annee" value={selY} />
                <input type="hidden" name="mois" value={selM} />
                <p style={{ fontSize: 13, color: "#7F7F7F", margin: "0 0 12px" }}>
                  ✨ Génère un résumé narratif du mois à partir de vos commentaires, à corriger puis copier-coller dans votre email au client.
                </p>
                <button type="submit" style={{ fontSize: 14, padding: "10px 16px", borderRadius: 8, border: "none", background: "linear-gradient(90deg,#92D050,#7cbf3f)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                  ✨ Générer la synthèse
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}
