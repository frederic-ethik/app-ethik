import type { DemiJourneeJour } from "@/lib/demi-journees";

// Calendrier mensuel : chaque jour est une case coupée en deux (matin en haut,
// après-midi en bas). Une moitié verte = demi-journée que le compteur théorique
// propose de compter. Indicateur INTERNE (page Rapports, jamais côté client).
export default function CalendrierDemiJournees({
  annee,
  mois, // 1-12
  jours, // Record<jour du mois, { matin, aprem }>
}: {
  annee: number;
  mois: number;
  jours: Record<number, DemiJourneeJour>;
}) {
  const VERT = "#92D050";
  const GRIS = "#eef1f3";

  const premierJour = new Date(Date.UTC(annee, mois - 1, 1)).getUTCDay(); // 0=dim … 6=sam
  const offset = (premierJour + 6) % 7; // lundi en tête
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();

  const cellules: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cellules.push(null);
  for (let d = 1; d <= nbJours; d++) cellules.push(d);
  while (cellules.length % 7 !== 0) cellules.push(null);

  let total = 0;
  for (let d = 1; d <= nbJours; d++) {
    const j = jours[d];
    if (j) total += (j.matin ? 0.5 : 0) + (j.aprem ? 0.5 : 0);
  }

  const entetes = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 5 }}>
        {entetes.map((h, i) => (
          <div key={`h${i}`} style={{ textAlign: "center", fontSize: 11, color: "#a5a5a5", fontWeight: 600, paddingBottom: 2 }}>{h}</div>
        ))}
        {cellules.map((d, i) => {
          if (d === null) return <div key={i} />;
          const jd = new Date(Date.UTC(annee, mois - 1, d)).getUTCDay();
          const weekend = jd === 0 || jd === 6;
          const j = jours[d];
          const matin = j?.matin ?? false;
          const aprem = j?.aprem ?? false;
          return (
            <div
              key={i}
              style={{ position: "relative", height: 46, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(0,0,0,.08)", opacity: weekend ? 0.55 : 1 }}
            >
              <div style={{ height: "50%", background: matin ? VERT : GRIS }} />
              <div style={{ height: "50%", background: aprem ? VERT : GRIS }} />
              <span style={{ position: "absolute", top: 2, left: 4, fontSize: 11, fontWeight: 600, color: matin || aprem ? "#33510f" : "#7F7F7F" }}>{d}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 12, flexWrap: "wrap", fontSize: 12, color: "#7F7F7F" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 14, background: VERT, borderRadius: 3, display: "inline-block" }} />
          demi-journée comptée (haut = matin, bas = après-midi)
        </span>
        <span style={{ marginLeft: "auto", fontWeight: 600, color: "#595959" }}>Total : {total.toLocaleString("fr-FR")} j</span>
      </div>
    </div>
  );
}
