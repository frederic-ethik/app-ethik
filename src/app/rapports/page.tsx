import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MOIS, formatHM, formatHeuresCourt, heureDe } from "@/lib/format";
import { validerJoursRapport } from "@/app/actions";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const WINDOW = 6;

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

  const moisStr = sp.mois || idxToKey(currentIdx);
  const [selY, selM] = moisStr.split("-").map(Number);
  const selKey = `${selY}-${pad(selM)}`;
  const focusIdx = toIdx(selY, selM - 1);

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

  // Fenêtre de 6 mois, anti-chronologique (le plus récent = focus, à gauche)
  const winMonths = Array.from({ length: WINDOW }, (_, i) => {
    const idx = focusIdx - i;
    return { idx, y: Math.floor(idx / 12), m: idx % 12, key: idxToKey(idx) };
  });
  const olderMois = idxToKey(focusIdx - WINDOW);
  const newerMois = idxToKey(Math.min(focusIdx + WINDOW, currentIdx));
  const canNewer = focusIdx < currentIdx;

  // Indicateurs du mois sélectionné (focus)
  const totalSel = monthTotal[selKey] ?? 0;
  const joursIndic = monthDays[selKey]?.size ?? 0;
  const joursFactures = factMap.get(selKey) ?? null;
  const moyFacturee = joursFactures ? totalSel / joursFactures : null;
  const detail = acts.filter((a) => `${a.dateAct.getUTCFullYear()}-${pad(a.dateAct.getUTCMonth() + 1)}` === selKey);

  const field = { fontSize: 14, padding: "8px 10px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8, background: "#fff", color: "#595959" } as const;
  const card = { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "18px 20px", marginBottom: 22 } as const;
  const partTitle = { fontSize: 11, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#a5a5a5", margin: "0 0 8px" };
  const stickyLeft = { position: "sticky" as const, left: 0, background: "#fff" };
  const navBtn = { fontSize: 13, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,.2)", background: "#fff", color: "#0077a8", textDecoration: "none", cursor: "pointer" } as const;

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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link href={`/rapports?client=${clientId}&mois=${olderMois}`} style={navBtn}>‹ 6 mois plus anciens</Link>
                {canNewer
                  ? <Link href={`/rapports?client=${clientId}&mois=${newerMois}`} style={navBtn}>6 mois plus récents ›</Link>
                  : <span style={{ ...navBtn, color: "#ccc", borderColor: "rgba(0,0,0,.08)", cursor: "default" }}>6 mois plus récents ›</span>}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
                <thead>
                  <tr style={{ color: "#7F7F7F" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,.2)", ...stickyLeft }}>Catégorie / Objet</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,.2)" }}>Moy.</th>
                    {winMonths.map((mm) => (
                      <th key={mm.key} style={{ textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap", borderBottom: "1px solid rgba(0,0,0,.2)", color: mm.key === selKey ? "#0077a8" : "#7F7F7F", fontWeight: mm.key === selKey ? 600 : 400 }}>
                        {MOIS[mm.m].slice(0, 4)} {String(mm.y).slice(2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={WINDOW + 2} style={{ padding: "12px 8px", color: "#a5a5a5" }}>Aucune activité.</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.key} style={{ borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                        <td style={{ padding: "6px 8px", ...stickyLeft }}>
                          <span style={{ fontWeight: 600 }}>{r.cat}</span><span style={{ color: "#7F7F7F" }}> › {r.obj}</span>
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#7F7F7F" }}>{formatHM(r.total / activeMonths)}</td>
                        {winMonths.map((mm) => (
                          <td key={mm.key} style={{ padding: "6px 8px", textAlign: "right", background: mm.key === selKey ? "#f3fbff" : undefined }}>{formatHM(r.per[mm.key] ?? 0)}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 600, borderTop: "2px solid rgba(0,0,0,.15)" }}>
                    <td style={{ padding: "7px 8px", ...stickyLeft }}>Total (heures)</td>
                    <td style={{ padding: "7px 8px", textAlign: "right" }}>{formatHM(rows.reduce((s, r) => s + r.total, 0) / activeMonths)}</td>
                    {winMonths.map((mm) => (
                      <td key={mm.key} style={{ padding: "7px 8px", textAlign: "right", background: mm.key === selKey ? "#e9f6ff" : undefined }}>{formatHM(monthTotal[mm.key] ?? 0)}</td>
                    ))}
                  </tr>
                  <tr style={{ fontWeight: 600, color: "#5f8e2a", background: "#f6fbef" }}>
                    <td style={{ padding: "6px 8px", ...stickyLeft, color: "#5f8e2a", background: "#f6fbef" }}>Jours facturés</td>
                    <td style={{ padding: "6px 8px" }}></td>
                    {winMonths.map((mm) => {
                      const v = factMap.get(mm.key);
                      return <td key={mm.key} style={{ padding: "6px 8px", textAlign: "right", background: mm.key === selKey ? "#eef7e1" : undefined }}>{v != null ? v.toLocaleString("fr-FR") : "–"}</td>;
                    })}
                  </tr>
                  <tr style={{ color: "#7F7F7F" }}>
                    <td style={{ padding: "5px 8px", ...stickyLeft, color: "#7F7F7F" }}>Moyenne / jour facturé</td>
                    <td style={{ padding: "5px 8px" }}></td>
                    {winMonths.map((mm) => {
                      const t = monthTotal[mm.key] ?? 0; const j = factMap.get(mm.key);
                      return <td key={mm.key} style={{ padding: "5px 8px", textAlign: "right", background: mm.key === selKey ? "#f6fbef" : undefined }}>{j ? formatHM(t / j) : "–"}</td>;
                    })}
                  </tr>
                  <tr style={{ color: "#a5a5a5", fontSize: 11 }}>
                    <td style={{ padding: "4px 8px", ...stickyLeft, color: "#a5a5a5" }}>Jours travaillés (indicatif)</td>
                    <td style={{ padding: "4px 8px" }}></td>
                    {winMonths.map((mm) => (
                      <td key={mm.key} style={{ padding: "4px 8px", textAlign: "right" }}>{monthDays[mm.key]?.size ?? "–"}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
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

          {/* Partie C — Synthèse IA (à venir) */}
          <div style={{ ...card, borderStyle: "dashed" }}>
            <p style={partTitle}>C · Synthèse rédigée par l'IA (Claude)</p>
            <p style={{ fontSize: 13, color: "#7F7F7F", margin: 0 }}>
              ✨ Génération automatique d&apos;un résumé narratif du mois, à copier-coller dans votre email au client.
              <br />À activer à l&apos;étape suivante (nécessite une clé API Anthropic — je vous guiderai).
            </p>
          </div>
        </>
      )}
    </>
  );
}
