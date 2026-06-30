"use client";

const lien = { fontSize: 14, padding: "10px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 600, color: "#fff", border: "none", cursor: "pointer" } as const;

// Id du textarea de synthèse (composant SynthesePeriode) — lu au moment de l'export période.
export const SYNTHESE_PERIODE_ID = "synthese-periode-text";

export default function RapportExports({
  mode,
  clientId,
  annee,
  mois,
  debut,
  fin,
}: {
  mode: "mois" | "periode";
  clientId: string;
  annee: number;
  mois: number;
  debut: string; // YYYY-MM-DD
  fin: string; // YYYY-MM-DD
}) {
  if (mode === "mois") {
    const qs = `client=${encodeURIComponent(clientId)}&annee=${annee}&mois=${mois}`;
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <a href={`/api/rapport?${qs}`} style={{ ...lien, background: "#00B0F0" }}>⬇ PDF</a>
        <a href={`/api/rapport-excel?${qs}`} style={{ ...lien, background: "#1D6F42" }}>⬇ Excel</a>
      </div>
    );
  }

  // Mode période : POST en récupérant la synthèse rédigée à l'écran (si présente).
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const champ = e.currentTarget.elements.namedItem("synthese") as HTMLInputElement | null;
    const ta = document.getElementById(SYNTHESE_PERIODE_ID) as HTMLTextAreaElement | null;
    if (champ) champ.value = ta?.value ?? "";
  };

  return (
    <form method="post" action="/api/rapport" onSubmit={onSubmit} style={{ display: "flex", gap: 10, alignItems: "flex-end", margin: 0 }}>
      <input type="hidden" name="client" value={clientId} />
      <input type="hidden" name="debut" value={debut} />
      <input type="hidden" name="fin" value={fin} />
      <input type="hidden" name="synthese" defaultValue="" />
      <button type="submit" style={{ ...lien, background: "#00B0F0" }}>⬇ PDF</button>
      <button type="submit" formAction="/api/rapport-excel" style={{ ...lien, background: "#1D6F42" }}>⬇ Excel</button>
    </form>
  );
}
