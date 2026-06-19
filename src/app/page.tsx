import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// Affichage double format : "2,25 h (2h15)"
function formatHeures(h: number): string {
  const dec = h.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return `${dec} h (${heures}h${min.toString().padStart(2, "0")})`;
}

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

  // Heures par client ce mois-ci
  const parClient = new Map<string, number>();
  for (const a of moisActs) {
    parClient.set(a.client.raisonSociale, (parClient.get(a.client.raisonSociale) ?? 0) + a.dureeH);
  }
  const clientsTries = [...parClient.entries()].sort((x, y) => y[1] - x[1]);
  const maxClient = clientsTries.length ? clientsTries[0][1] : 1;

  const recentes = moisActs.slice(0, 8);

  return (
    <div style={{ minHeight: "100vh", background: "#eef0f2", color: "#595959", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 28px", background: "#fff", borderBottom: "1px solid rgba(0,0,0,.1)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Ethik & Co" style={{ height: 46 }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#595959" }}>Tableau de bord</div>
          <div style={{ fontSize: 13, color: "#7F7F7F" }}>Gestion des temps &amp; frais — {MOIS[mois]} {annee}</div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 28px" }}>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
          <Stat label={`Heures en ${MOIS[mois]}`} value={formatHeures(moisActs.reduce((s, a) => s + a.dureeH, 0))} accent="#00B0F0" />
          <Stat label={`Activités en ${MOIS[mois]}`} value={`${moisActs.length}`} accent="#92D050" />
          <Stat label="Total activités (historique)" value={totalActivites.toLocaleString("fr-FR")} accent="#FFC000" />
          <Stat label="Heures totales (historique)" value={`${Math.round(totalHeures).toLocaleString("fr-FR")} h`} accent="#00B0F0" />
        </section>

        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "18px 20px", marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>Heures par client — {MOIS[mois]} {annee}</h2>
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

        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "18px 20px" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>Activités récentes</h2>
          {recentes.length === 0 ? (
            <p style={{ fontSize: 14, color: "#7F7F7F" }}>Rien à afficher pour le moment.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#7F7F7F", fontSize: 12 }}>
                  <th style={{ padding: "6px 6px", fontWeight: 600 }}>Date</th>
                  <th style={{ padding: "6px 6px", fontWeight: 600 }}>Client</th>
                  <th style={{ padding: "6px 6px", fontWeight: 600 }}>Catégorie</th>
                  <th style={{ padding: "6px 6px", fontWeight: 600, textAlign: "right" }}>Durée</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((a) => (
                  <tr key={a.id} style={{ borderTop: "1px solid rgba(0,0,0,.08)", fontSize: 13 }}>
                    <td style={{ padding: "7px 6px" }}>{a.dateAct.toLocaleDateString("fr-FR")}</td>
                    <td style={{ padding: "7px 6px" }}>{a.client.raisonSociale}</td>
                    <td style={{ padding: "7px 6px", color: "#7F7F7F" }}>{a.missionType?.categorie ?? "—"}</td>
                    <td style={{ padding: "7px 6px", textAlign: "right" }}>{a.dureeH.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p style={{ fontSize: 12, color: "#a5a5a5", marginTop: 22, textAlign: "center" }}>
          Données réelles issues de votre base Neon · {totalActivites.toLocaleString("fr-FR")} activités migrées
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 10, padding: "14px 16px", borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 12, color: "#7F7F7F", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "#595959" }}>{value}</div>
    </div>
  );
}
