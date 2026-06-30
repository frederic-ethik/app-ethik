import { prisma } from "@/lib/prisma";
import { MOIS, formatHM, heureDe } from "@/lib/format";
import { validerJoursRapport, genererSynthese } from "@/app/actions";
import RapportNav from "@/components/RapportNav";
import RapportFiltre from "@/components/RapportFiltre";
import RapportExports from "@/components/RapportExports";
import SyntheseTable from "@/components/SyntheseTable";
import SyntheseClient from "@/components/SyntheseClient";
import SynthesePeriode from "@/components/SynthesePeriode";
import CalendrierDetailMois, { type ActiviteDetail } from "@/components/CalendrierDetailMois";
import { totalDemiJournees, demiJourneesDetailParJour, repartirPlage, REGLE_DEMI_J_DEFAUT, type ActivitePlage, type RegleDemiJournee, type DemiJourneeJour } from "@/lib/demi-journees";

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
const frD = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
const isoD = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; mois?: string; saved?: string; mode?: string; debut?: string; fin?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const currentIdx = toIdx(now.getUTCFullYear(), now.getUTCMonth());
  const mode: "mois" | "periode" = sp.mode === "periode" ? "periode" : "mois";

  const clients = await prisma.client.findMany({
    orderBy: [{ actif: "desc" }, { raisonSociale: "asc" }],
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
  const plagesMois: Record<string, ActivitePlage[]> = {};
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
    // Plage horaire de l'activité (pour le décompte des demi-journées). On ignore les sessions non clôturées.
    if (a.finAct) {
      const debutMin = a.debutAct.getUTCHours() * 60 + a.debutAct.getUTCMinutes();
      const finMin = a.finAct.getUTCHours() * 60 + a.finAct.getUTCMinutes();
      (plagesMois[mk] ??= []).push({ jour: a.dateAct.toISOString().slice(0, 10), debutMin, finMin });
    }
  }

  // Règle de calcul des demi-journées (paramétrable dans Réglages)
  const regleDemiJ: RegleDemiJournee = {
    matinFinMin: settings?.demiJMatinFinMin ?? REGLE_DEMI_J_DEFAUT.matinFinMin,
    apremDebutMin: settings?.demiJApremDebutMin ?? REGLE_DEMI_J_DEFAUT.apremDebutMin,
    seuilMin: settings?.demiJSeuilMin ?? REGLE_DEMI_J_DEFAUT.seuilMin,
  };
  const joursDe = (mk: string) => totalDemiJournees(plagesMois[mk] ?? [], regleDemiJ);
  const rows = [...rowsMap.values()].sort((x, y) => x.cat.localeCompare(y.cat) || x.obj.localeCompare(y.obj));
  const activeMonths = Object.values(monthTotal).filter((t) => t > 0).length || 1;

  // Données du calendrier + détail pour un mois donné (réutilisé en mensuel et par mois en mode période)
  const donneesCalendrier = (mk: string, y: number, m: number) => {
    const detailDemiJ = demiJourneesDetailParJour(plagesMois[mk] ?? [], regleDemiJ);
    const joursCal: Record<number, DemiJourneeJour> = {};
    const nbJours = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = 1; d <= nbJours; d++) {
      const det = detailDemiJ.get(`${y}-${pad(m)}-${pad(d)}`);
      if (det) joursCal[d] = det;
    }
    const activitesDetail: ActiviteDetail[] = acts
      .filter((a) => `${a.dateAct.getUTCFullYear()}-${pad(a.dateAct.getUTCMonth() + 1)}` === mk)
      .map((a) => {
        const debutMin = a.debutAct.getUTCHours() * 60 + a.debutAct.getUTCMinutes();
        const finMin = a.finAct ? a.finAct.getUTCHours() * 60 + a.finAct.getUTCMinutes() : debutMin;
        const rep = a.finAct ? repartirPlage(debutMin, finMin, regleDemiJ) : { matin: 0, aprem: 0 };
        return {
          key: a.id,
          day: a.dateAct.getUTCDate(),
          dateLabel: a.dateAct.toLocaleDateString("fr-FR"),
          horaire: `${heureDe(a.debutAct)}${a.finAct ? `–${heureDe(a.finAct)}` : ""}`,
          type: a.missionType ? `${a.missionType.categorie} › ${a.missionType.objet}` : "—",
          commentaire: a.commentaire ?? "",
          dureeLabel: formatHM(a.dureeH),
          duree: a.dureeH,
          aMatin: rep.matin > 0,
          aAprem: rep.aprem > 0,
        };
      });
    return { joursCal, activitesDetail };
  };

  // ===================== Sélection MENSUELLE =====================
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

  // ===================== Sélection PÉRIODE (date à date) =====================
  const defDebut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defFin = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const parseISO = (s: string | undefined, fb: Date) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fb;
    const d = new Date(`${s}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? fb : d;
  };
  let debutDate = parseISO(sp.debut, defDebut);
  let finDate = parseISO(sp.fin, defFin);
  if (debutDate > finDate) [debutDate, finDate] = [finDate, debutDate];
  const debutISO = isoD(debutDate);
  const finISO = isoD(finDate);

  const pDebutIdx = toIdx(debutDate.getUTCFullYear(), debutDate.getUTCMonth());
  const pFinIdx = toIdx(finDate.getUTCFullYear(), finDate.getUTCMonth());
  const periodMonths = Array.from({ length: pFinIdx - pDebutIdx + 1 }, (_, i) => {
    const idx = pDebutIdx + i;
    return { key: idxToKey(idx), label: `${MOIS[idx % 12].slice(0, 4)} ${String(Math.floor(idx / 12)).slice(2)}`, y: Math.floor(idx / 12), m: (idx % 12) + 1 };
  });

  const field = { fontSize: 14, padding: "8px 10px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8, background: "#fff", color: "#595959" } as const;
  const card = { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "18px 20px", marginBottom: 22 } as const;
  const partTitle = { fontSize: 11, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#a5a5a5", margin: "0 0 8px" };

  // ----- Données du tableau de synthèse (selon le mode) -----
  let months: { key: string; label: string }[];
  let rowsData: { key: string; cat: string; obj: string; moy: number; per: number[] }[];
  let totalRow: number[];
  let facturesRow: (number | null)[];
  let joursRow: number[];

  if (mode === "periode") {
    months = periodMonths.map((mm) => ({ key: mm.key, label: mm.label }));
    rowsData = rows
      .map((r) => ({ key: r.key, cat: r.cat, obj: r.obj, moy: 0, per: periodMonths.map((mm) => r.per[mm.key] ?? 0) }))
      .filter((rd) => rd.per.some((v) => v > 0));
    totalRow = periodMonths.map((mm) => monthTotal[mm.key] ?? 0);
    facturesRow = periodMonths.map((mm) => factMap.get(mm.key) ?? null);
    joursRow = periodMonths.map((mm) => joursDe(mm.key));
  } else {
    // Tous les mois du focus vers le plus ancien (anti-chrono) — le composant client
    // affichera autant de colonnes que la largeur le permet.
    const allMonths = Array.from({ length: Math.min(focusIdx - sliderMin + 1, 60) }, (_, i) => {
      const idx = focusIdx - i;
      return { key: idxToKey(idx), label: `${MOIS[idx % 12].slice(0, 4)} ${String(Math.floor(idx / 12)).slice(2)}` };
    });
    months = allMonths;
    rowsData = rows.map((r) => ({ key: r.key, cat: r.cat, obj: r.obj, moy: r.total / activeMonths, per: allMonths.map((mm) => r.per[mm.key] ?? 0) }));
    totalRow = allMonths.map((mm) => monthTotal[mm.key] ?? 0);
    facturesRow = allMonths.map((mm) => factMap.get(mm.key) ?? null);
    joursRow = allMonths.map((mm) => joursDe(mm.key));
  }
  const moyTotal = rows.reduce((s, r) => s + r.total, 0) / activeMonths;

  // Indicateurs du mois sélectionné (mensuel)
  const totalSel = monthTotal[selKey] ?? 0;
  const joursIndic = joursDe(selKey);
  const joursFactures = factMap.get(selKey) ?? null;
  const moyFacturee = joursFactures ? totalSel / joursFactures : null;
  const synthese = rapports.find((r) => r.annee === selY && r.mois === selM)?.syntheseValidee ?? "";

  // Indicateurs de la période
  const totalPeriode = totalRow.reduce((s, v) => s + v, 0);
  const joursPeriodeVals = facturesRow.filter((j): j is number => j != null);
  const joursPeriode = joursPeriodeVals.length ? joursPeriodeVals.reduce((s, j) => s + j, 0) : null;
  const moyPeriode = joursPeriode ? totalPeriode / joursPeriode : null;

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: "0 0 14px" }}>Rapport client</h1>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap" }}>
        <RapportFiltre clients={clients} clientId={clientId!} mode={mode} mois={moisStr} debut={debutISO} fin={finISO} />
        {client && (
          <RapportExports mode={mode} clientId={clientId!} annee={selY} mois={selM} debut={debutISO} fin={finISO} />
        )}
      </div>

      {!client ? (
        <div style={card}>Aucun client.</div>
      ) : (
        <>
          <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{client.raisonSociale}</div>
              <div style={{ fontSize: 12, color: "#7F7F7F" }}>
                {mode === "periode" ? `Du ${frD(debutDate)} au ${frD(finDate)}` : `${MOIS[selM - 1]} ${selY}`}
                {client.cibleJoursMensuelle ? ` · cible ${client.cibleJoursMensuelle} j/mois` : ""}
              </div>
            </div>
            <span style={{ fontSize: 12, padding: "4px 11px", borderRadius: 12, background: "#e0f5fe", color: "#0077a8" }}>
              {TYPE_LABEL[client.typeClient] ?? client.typeClient}
            </span>
          </div>

          {/* Partie A — Tableau de synthèse */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <p style={{ ...partTitle, margin: 0 }}>A · Tableau de synthèse{mode === "periode" ? " — période" : ""}</p>
              {mode === "mois" && (
                <div style={{ flex: 1, maxWidth: 420, minWidth: 240 }}>
                  <RapportNav clientId={clientId!} min={sliderMin} max={sliderMax} value={focusIdx} />
                </div>
              )}
            </div>

            <SyntheseTable
              selKey={mode === "periode" ? "" : selKey}
              months={months}
              rows={rowsData}
              totalRow={totalRow}
              facturesRow={facturesRow}
              joursRow={joursRow}
              moyTotal={moyTotal}
              mode={mode}
            />
            <p style={{ fontSize: 11, color: "#a5a5a5", margin: "10px 0 0" }}>
              « Jours travaillés (indicatif) » = jours distincts avec activité (aide au calcul). Ce sont les « Jours facturés » qui font foi
              {mode === "periode" ? " (saisis mois par mois en vue mensuelle)." : " — modifiez-les ci-dessous (sélectionnez le mois voulu)."}
            </p>
          </div>

          {/* Partie C — Synthèse rédigée par l'IA */}
          <div style={card}>
            <p style={partTitle}>C · Synthèse rédigée par l&apos;IA (Claude){mode === "periode" ? " — période" : ""}</p>
            {mode === "periode" ? (
              <SynthesePeriode clientId={clientId!} debut={debutISO} fin={finISO} />
            ) : synthese ? (
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

          {/* Facturation */}
          <div style={{ ...card, background: "#fff6e0", borderColor: "#FFC000" }}>
            {mode === "periode" ? (
              <>
                <p style={partTitle}>Facturation — période</p>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div><div style={{ fontSize: 12, color: "#997300" }}>Total heures</div><div style={{ fontSize: 18, fontWeight: 600 }}>{formatHM(totalPeriode)}</div></div>
                  <div><div style={{ fontSize: 12, color: "#5f8e2a" }}>Jours facturés (somme des mois)</div><div style={{ fontSize: 18, fontWeight: 600, color: "#5f8e2a" }}>{joursPeriode != null ? `${joursPeriode.toLocaleString("fr-FR")} j` : "—"}</div></div>
                  <div><div style={{ fontSize: 12, color: "#997300" }}>Moyenne / jour facturé</div><div style={{ fontSize: 18, fontWeight: 600 }}>{moyPeriode ? formatHM(moyPeriode) : "—"}</div></div>
                </div>
                <p style={{ fontSize: 11, color: "#997300", margin: "10px 0 0" }}>
                  Les jours facturés se saisissent mois par mois en vue mensuelle ; ici on en affiche la somme sur la période.
                </p>
              </>
            ) : (
              <>
                <p style={partTitle}>Facturation — {MOIS[selM - 1]} {selY}</p>
                {sp.saved && (
                  <div style={{ background: "#eef7e1", color: "#5f8e2a", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
                    ✓ Jours facturés enregistrés.
                  </div>
                )}
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div><div style={{ fontSize: 12, color: "#997300" }}>Total heures</div><div style={{ fontSize: 18, fontWeight: 600 }}>{formatHM(totalSel)}</div></div>
                  <div><div style={{ fontSize: 12, color: "#a5a5a5" }}>Jours travaillés (indicatif)</div><div style={{ fontSize: 18, fontWeight: 600, color: "#a5a5a5" }}>{joursIndic.toLocaleString("fr-FR")} j</div></div>
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
              </>
            )}
          </div>

          {/* Calendrier des demi-journées + détail filtrable (aide interne, non partagé au client) */}
          {mode === "periode"
            ? periodMonths.map((mm) => {
                const { joursCal, activitesDetail } = donneesCalendrier(mm.key, mm.y, mm.m);
                return (
                  <CalendrierDetailMois
                    key={mm.key}
                    annee={mm.y}
                    mois={mm.m}
                    moisLabel={`${MOIS[mm.m - 1]} ${mm.y}`}
                    jours={joursCal}
                    activites={activitesDetail}
                  />
                );
              })
            : (() => {
                const { joursCal, activitesDetail } = donneesCalendrier(selKey, selY, selM);
                return (
                  <CalendrierDetailMois
                    annee={selY}
                    mois={selM}
                    moisLabel={`${MOIS[selM - 1]} ${selY}`}
                    jours={joursCal}
                    activites={activitesDetail}
                  />
                );
              })()}
        </>
      )}
    </>
  );
}
