import { prisma } from "@/lib/prisma";
import { MOIS, formatHeures } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const annee = now.getUTCFullYear();
  const mois = now.getUTCMonth();
  const debutMois = new Date(Date.UTC(annee, mois, 1));
  const finMois = new Date(Date.UTC(annee, mois + 1, 1));

  const [totalActivites, totalAgg, moisActs] = await Promise.all([
    prisma.activity.count(),
    prisma.activity.aggregate({ _sum: { dureeH: true } }),
    prisma.activity.findMany({
      where: { dateAct: { gte: debutMois, lt: finMois } },
      include: { client: true, missionType: true },
      orderBy: [{ dateAct: "desc" }, { debutAct: "desc" }],
    }),
  ]);

  const totalHeures = totalAgg._sum.dureeH ?? 0;
  const heuresMois = moisActs.reduce((s, a) => s + a.dureeH, 0);

  const parClient = new Map<string, number>();
  for (const a of moisActs) {
    parClient.set(a.client.raisonSociale, (parClient.get(a.client.raisonSociale) ?? 0) + a.dureeH);
  }
  const clientsTries = [...parClient.entries()].sort((x, y) => y[1] - x[1]);
  const maxClient = clientsTries.length ? clientsTries[0][1] : 1;
  const recentes = moisActs.slice(0, 8);

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: "0 0 4px" }}>Tableau de bord</h1>
      <p style={{ fontSize: 13, color: "#7F7F7F", margin: "0 0 22px" }}>{MOIS[mois]} {annee}</p>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Stat label={`Heures en ${MOIS[mois]}`} value={formatHeures(heuresMois)} accent="#00B0F0" />
        <Stat label={`Activités en ${MOIS[mois]}`} value={`${moisActs.length}`} accent="#92D050" />
        <Stat label="Total activités (historique)" value={totalActivites.toLocaleString("fr-FR")} accent="#FFC000" />
        <Stat label="Heures totales (historique)" value={`${Math.round(totalHeures).toLocaleString("fr-FR")} h`} accent="#00B0F0" />
      </section>

      <section style={card}>
        <h2 style={h2}>Heures par client — {MOIS[mois]} {annee}</h2>
        {clientsTries.length === 0 ? (
          <p style={{ fontSize: 14, color: "#7F7F7F" }}>Aucune activité saisie ce mois-ci.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {clientsTries.map(([nom, h]) => (
              <div key={nom}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#7F7F7F", marginBottom: 4 }}>
                  <span>{nom}</span>
                  <span>{h.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</span>
                </div>
                <div style={{ height: 9, background: "#e6eaec", borderRadius: 5 }}>
                  <div style={{ height: 9, width: `${Math.max(4, (h / maxClient) * 100)}%`, background: "#00B0F0", borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
                <tr key={a.id} style={{ borderTop: "1px solid rgba(0,0,0,.08)", fontSize: 13 }}>
                  <td style={td}>{a.dateAct.toLocaleDateString("fr-FR")}</td>
                  <td style={td}>{a.client.raisonSociale}</td>
                  <td style={{ ...td, color: "#7F7F7F" }}>{a.missionType?.categorie ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{a.dureeH.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p style={{ fontSize: 12, color: "#a5a5a5", marginTop: 22, textAlign: "center" }}>
        Données réelles issues de votre base Neon · {totalActivites.toLocaleString("fr-FR")} activités migrées
      </p>
    </>
  );
}

const card = { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "18px 20px", marginBottom: 22 } as const;
const h2 = { fontSize: 15, fontWeight: 600, margin: "0 0 14px" } as const;
const th = { padding: "6px 6px", fontWeight: 600 } as const;
const td = { padding: "7px 6px" } as const;

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 10, padding: "14px 16px", borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 12, color: "#7F7F7F", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "#595959" }}>{value}</div>
    </div>
  );
}
