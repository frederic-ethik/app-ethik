import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MOIS, formatHM, parisParts } from "@/lib/format";
import { totalDemiJournees, REGLE_DEMI_J_DEFAUT, type ActivitePlage } from "@/lib/demi-journees";

export const dynamic = "force-dynamic";

type ActLite = {
  dateAct: Date;
  debutAct: Date;
  finAct: Date | null;
  dureeH: number;
  client: { id: string; raisonSociale: string; estStructure: boolean; typeClient: string; cibleJoursMensuelle: number | null };
  missionType: { categorie: string } | null;
};

// Types de clients dont le travail est facturable (sinon : non facturé)
const FACTURABLE_TYPES = new Set(["ESS_ASSO", "ESS_SCOOP", "SECTEUR_MARCHAND"]);

const hLabel = (h: number) => (h > 0 ? formatHM(h) : "0h");
const jLabel = (j: number) => `${j.toLocaleString("fr-FR")} j`;

const plagesDe = (acts: ActLite[]): ActivitePlage[] =>
  acts
    .filter((a) => a.finAct)
    .map((a) => ({
      jour: a.dateAct.toISOString().slice(0, 10),
      debutMin: a.debutAct.getUTCHours() * 60 + a.debutAct.getUTCMinutes(),
      finMin: a.finAct!.getUTCHours() * 60 + a.finAct!.getUTCMinutes(),
    }));

const bucketOf = (a: ActLite): "facturable" | "fonctionnement" | "nonfacture" => {
  if (a.client.estStructure) return "fonctionnement";
  return FACTURABLE_TYPES.has(a.client.typeClient) ? "facturable" : "nonfacture";
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const moisKey = (idx: number) => `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}`;

export default async function Home({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const curIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const [py, pm] = (sp.mois ?? "").split("-").map(Number);
  let viewIdx = py && pm ? py * 12 + (pm - 1) : curIdx;
  if (viewIdx > curIdx) viewIdx = curIdx; // pas de mois futur
  const annee = Math.floor(viewIdx / 12);
  const mois = viewIdx % 12;
  const estMoisCourant = viewIdx === curIdx;
  const prevMois = moisKey(viewIdx - 1);
  const nextMois = estMoisCourant ? null : moisKey(viewIdx + 1);

  const debutMois = new Date(Date.UTC(annee, mois, 1));
  const finMois = new Date(Date.UTC(annee, mois + 1, 1));
  const todayStr = parisParts(now).date;

  // Jours ouvrés du mois affiché (lundi→vendredi ; jours fériés non déduits)
  let joursOuvres = 0;
  const dernierJour = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
  for (let d = 1; d <= dernierJour; d++) {
    const wd = new Date(Date.UTC(annee, mois, d)).getUTCDay();
    if (wd >= 1 && wd <= 5) joursOuvres++;
  }

  const [settings, clientsActifs, moisActs] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.client.findMany({
      where: { actif: true, estStructure: false },
      select: { id: true, raisonSociale: true, cibleJoursMensuelle: true },
    }),
    prisma.activity.findMany({
      where: { dateAct: { gte: debutMois, lt: finMois } },
      include: { client: { select: { id: true, raisonSociale: true, estStructure: true, typeClient: true, cibleJoursMensuelle: true } }, missionType: { select: { categorie: true } } },
      orderBy: [{ dateAct: "desc" }, { debutAct: "desc" }],
    }),
  ]);

  const regle = {
    matinFinMin: settings?.demiJMatinFinMin ?? REGLE_DEMI_J_DEFAUT.matinFinMin,
    apremDebutMin: settings?.demiJApremDebutMin ?? REGLE_DEMI_J_DEFAUT.apremDebutMin,
    seuilMin: settings?.demiJSeuilMin ?? REGLE_DEMI_J_DEFAUT.seuilMin,
  };
  const jours = (acts: ActLite[]) => totalDemiJournees(plagesDe(acts), regle);

  const heuresMois = moisActs.reduce((s, a) => s + a.dureeH, 0);
  const joursMois = jours(moisActs);

  // Aujourd'hui
  const todayActs = moisActs.filter((a) => a.dateAct.toISOString().slice(0, 10) === todayStr);
  const heuresAuj = todayActs.reduce((s, a) => s + a.dureeH, 0);

  // Répartition par nature (facturable / fonctionnement / non facturé)
  const buckets = { facturable: [] as ActLite[], fonctionnement: [] as ActLite[], nonfacture: [] as ActLite[] };
  for (const a of moisActs) buckets[bucketOf(a)].push(a);
  const brique = (acts: ActLite[]) => {
    const h = acts.reduce((s, a) => s + a.dureeH, 0);
    return { h, j: jours(acts), pct: heuresMois ? Math.round((h / heuresMois) * 100) : 0 };
  };
  const bF = brique(buckets.facturable);
  const bG = brique(buckets.fonctionnement);
  const bN = brique(buckets.nonfacture);

  // Progression par client (jours vs cible) — clients actifs hors structure, avec cible ou activité
  const joursParClient = new Map<string, number>();
  const grouped = new Map<string, ActLite[]>();
  for (const a of moisActs) {
    if (a.client.estStructure) continue;
    (grouped.get(a.client.id) ?? grouped.set(a.client.id, []).get(a.client.id)!).push(a);
  }
  for (const [id, acts] of grouped) joursParClient.set(id, jours(acts));
  const progression = clientsActifs
    .map((c) => ({ nom: c.raisonSociale, cible: c.cibleJoursMensuelle, j: joursParClient.get(c.id) ?? 0 }))
    .filter((p) => p.cible != null || p.j > 0)
    .sort((a, b) => b.j - a.j);

  const recentes = moisActs.slice(0, 8);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: 0 }}>Tableau de bord</h1>
          <Link
            href="/saisie?mode=badgeage"
            title="Démarrer un badgeage (chrono)"
            aria-label="Démarrer un badgeage (chrono)"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", background: "#00B0F0", color: "#fff", fontSize: 24, fontWeight: 600, textDecoration: "none", lineHeight: 0 }}
          >
            +
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link href={`/?mois=${prevMois}`} aria-label="Mois précédent" style={navArrow}>‹</Link>
          <span style={{ fontSize: 14, color: "#595959", fontWeight: 600, minWidth: 110, textAlign: "center" }}>{MOIS[mois]} {annee}</span>
          {nextMois ? (
            <Link href={`/?mois=${nextMois}`} aria-label="Mois suivant" style={navArrow}>›</Link>
          ) : (
            <span style={{ ...navArrow, color: "#d0d0d0", cursor: "default" }}>›</span>
          )}
        </div>
      </div>

      {/* Aujourd'hui + ce mois */}
      <section style={{ display: "grid", gap: 14, marginBottom: 22, gridTemplateColumns: `repeat(${estMoisCourant ? 3 : 2}, minmax(0, 1fr))` }}>
        {estMoisCourant && (
          <Stat label="Aujourd'hui" value={hLabel(heuresAuj)} sub={`${todayActs.length} activité${todayActs.length > 1 ? "s" : ""}`} accent="#FFC000" />
        )}
        <Stat label={`Heures en ${MOIS[mois]}`} value={hLabel(heuresMois)} sub={`${moisActs.length} activités`} accent="#00B0F0" />
        <Stat label={`Jours travaillés en ${MOIS[mois]}`} value={jLabel(joursMois)} sub={`sur ${joursOuvres} jours ouvrés ce mois`} accent="#92D050" />
      </section>

      {/* Répartition du mois */}
      <h2 style={h2}>Répartition du mois</h2>
      <section style={{ display: "grid", gap: 14, marginBottom: 24, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <Brique titre="Facturable" h={bF.h} j={bF.j} pct={bF.pct} accent="#92D050" />
        <Brique titre="Fonctionnement (E&C)" h={bG.h} j={bG.j} pct={bG.pct} accent="#00B0F0" />
        <Brique titre="Bénévolat" h={bN.h} j={bN.j} pct={bN.pct} accent="#FFC000" />
      </section>

      {/* Progression par client */}
      <section style={card}>
        <h2 style={h2}>Progression par client — {MOIS[mois]} {annee}</h2>
        {progression.length === 0 ? (
          <p style={{ fontSize: 14, color: "#7F7F7F" }}>Aucune activité client ce mois-ci.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {progression.map((p) => {
              const atteint = p.cible != null && p.j >= p.cible;
              const width = p.cible != null && p.cible > 0 ? Math.min(100, (p.j / p.cible) * 100) : p.j > 0 ? 100 : 0;
              return (
                <div key={p.nom}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7F7F7F", marginBottom: 4 }}>
                    <span>{p.nom}</span>
                    <span style={{ color: atteint ? "#5f8e2a" : "#595959" }}>
                      {jLabel(p.j)}{p.cible != null ? ` / ${p.cible} j` : ""}{atteint ? " ✓" : ""}
                    </span>
                  </div>
                  <div style={{ height: 9, background: "#e6eaec", borderRadius: 5 }}>
                    <div style={{ height: 9, width: `${Math.max(width, p.j > 0 ? 4 : 0)}%`, background: atteint ? "#92D050" : "#00B0F0", borderRadius: 5 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Activités récentes */}
      <section style={card}>
        <h2 style={h2}>Activités récentes</h2>
        {recentes.length === 0 ? (
          <p style={{ fontSize: 14, color: "#7F7F7F" }}>Rien à afficher pour le moment.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#7F7F7F", fontSize: 12 }}>
                <th style={th}>Date</th><th style={th}>Client</th><th style={th}>Catégorie</th>
                <th style={{ ...th, textAlign: "right" }}>Durée</th>
              </tr>
            </thead>
            <tbody>
              {recentes.map((a) => (
                <tr key={a.dateAct.toISOString() + a.debutAct.toISOString()} style={{ borderTop: "1px solid rgba(0,0,0,.08)", fontSize: 13 }}>
                  <td style={td}>{a.dateAct.toLocaleDateString("fr-FR")}</td>
                  <td style={td}>{a.client.raisonSociale}</td>
                  <td style={{ ...td, color: "#7F7F7F" }}>{a.missionType?.categorie ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{hLabel(a.dureeH)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

const card = { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "18px 20px", marginBottom: 22 } as const;
const h2 = { fontSize: 15, fontWeight: 600, color: "#595959", margin: "0 0 14px" } as const;
const th = { padding: "6px 6px", fontWeight: 600 } as const;
const td = { padding: "7px 6px" } as const;
const navArrow = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, textDecoration: "none", color: "#7F7F7F", fontSize: 18, border: "1px solid rgba(0,0,0,.12)", background: "#fff" } as const;

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 10, padding: "14px 16px", borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 12, color: "#7F7F7F", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "#595959" }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: "#a5a5a5", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function Brique({ titre, h, j, pct, accent }: { titre: string; h: number; j: number; pct: number; accent: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 10, padding: "16px 18px", borderLeft: `4px solid ${accent}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#595959" }}>{titre}</div>
        <div style={{ fontSize: 11, color: "#a5a5a5" }}>{pct} %</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent, margin: "8px 0 2px" }}>{hLabel(h)}</div>
      <div style={{ fontSize: 13, color: "#7F7F7F" }}>{jLabel(j)} théoriques</div>
    </div>
  );
}
