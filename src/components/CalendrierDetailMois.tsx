"use client";

import { useState } from "react";
import { formatHM } from "@/lib/format";
import type { DemiJourneeJour } from "@/lib/demi-journees";

export type ActiviteDetail = {
  key: string;
  day: number;
  dateLabel: string;
  horaire: string;
  type: string;
  commentaire: string;
  dureeLabel: string;
  duree: number;
  aMatin: boolean;
  aAprem: boolean;
};

const minToHM = (min: number) => {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
  if (h) return `${h}h`;
  return `${m}min`;
};

const card = { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "18px 20px", marginBottom: 22 } as const;
const partTitle = { fontSize: 11, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#a5a5a5", margin: "0 0 8px" };

export default function CalendrierDetailMois({
  annee,
  mois, // 1-12
  moisLabel,
  jours, // Record<jour du mois, DemiJourneeJour>
  activites,
}: {
  annee: number;
  mois: number;
  moisLabel: string;
  jours: Record<number, DemiJourneeJour>;
  activites: ActiviteDetail[];
}) {
  const [sel, setSel] = useState<{ day: number; half: "matin" | "aprem" } | null>(null);

  const VERT = "#92D050";
  const VERT_CLAIR = "#e3efd0";
  const GRIS = "#eef1f3";

  const premierJour = new Date(Date.UTC(annee, mois - 1, 1)).getUTCDay();
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

  const toggle = (day: number, half: "matin" | "aprem") => {
    setSel((s) => (s && s.day === day && s.half === half ? null : { day, half }));
  };

  const lignes = sel ? activites.filter((a) => a.day === sel.day && (sel.half === "matin" ? a.aMatin : a.aAprem)) : activites;
  const totalLignes = lignes.reduce((s, a) => s + a.duree, 0);

  const entetes = ["L", "M", "M", "J", "V", "S", "D"];

  const demiCell = (d: number, half: "matin" | "aprem", min: number, compte: boolean) => {
    const actif = min > 0;
    const choisi = sel?.day === d && sel.half === half;
    return (
      <div
        onClick={actif ? () => toggle(d, half) : undefined}
        style={{
          height: "50%",
          background: compte ? VERT : actif ? VERT_CLAIR : GRIS,
          cursor: actif ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 600,
          color: compte ? "#2e4708" : "#6b8e3a",
          boxShadow: choisi ? "inset 0 0 0 2px #0077a8" : undefined,
        }}
      >
        {actif ? minToHM(min) : ""}
      </div>
    );
  };

  return (
    <>
      {/* Calendrier */}
      <div style={card}>
        <p style={partTitle}>Calendrier des demi-journées (indicatif) — {moisLabel}</p>
        <p style={{ fontSize: 12, color: "#a5a5a5", margin: "0 0 14px" }}>
          Ce que le compteur propose de comptabiliser, jour par jour (durée par demi-journée). <strong>Clique une demi-journée</strong> pour filtrer le détail ci-dessous. Indicateur interne — jamais visible par le client.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 5 }}>
          {entetes.map((h, i) => (
            <div key={`h${i}`} style={{ textAlign: "center", fontSize: 11, color: "#a5a5a5", fontWeight: 600, paddingBottom: 2 }}>{h}</div>
          ))}
          {cellules.map((d, i) => {
            if (d === null) return <div key={i} />;
            const jd = new Date(Date.UTC(annee, mois - 1, d)).getUTCDay();
            const weekend = jd === 0 || jd === 6;
            const j = jours[d];
            return (
              <div key={i} style={{ position: "relative", height: 54, borderRadius: 6, overflow: "hidden", border: "1px solid rgba(0,0,0,.08)", opacity: weekend && !j ? 0.5 : 1 }}>
                {demiCell(d, "matin", j?.matinMin ?? 0, j?.matin ?? false)}
                {demiCell(d, "aprem", j?.apremMin ?? 0, j?.aprem ?? false)}
                <span style={{ position: "absolute", top: 1, left: 3, fontSize: 10, fontWeight: 700, color: j?.matin || j?.aprem ? "#33510f" : "#9aa0a6" }}>{d}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 12, flexWrap: "wrap", fontSize: 12, color: "#7F7F7F" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 13, height: 13, background: VERT, borderRadius: 3, display: "inline-block" }} /> demi-journée comptée
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 13, height: 13, background: VERT_CLAIR, borderRadius: 3, display: "inline-block" }} /> activité sous le seuil
          </span>
          <span style={{ marginLeft: "auto", fontWeight: 600, color: "#595959" }}>Total : {total.toLocaleString("fr-FR")} j</span>
        </div>
      </div>

      {/* Détail (filtrable) */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <p style={{ ...partTitle, margin: 0 }}>
            B · Détail des activités — {moisLabel}
            {sel ? ` · ${sel.day} ${moisLabel.split(" ")[0]} (${sel.half === "matin" ? "matin" : "après-midi"})` : ""}
          </p>
          {sel && (
            <button onClick={() => setSel(null)} style={{ fontSize: 12, color: "#0077a8", background: "none", border: "none", cursor: "pointer" }}>
              ✕ Voir tout le mois
            </button>
          )}
        </div>

        {lignes.length === 0 ? (
          <p style={{ fontSize: 14, color: "#a5a5a5", marginTop: 8 }}>{sel ? "Aucune activité sur cette demi-journée." : "Aucune activité ce mois-ci."}</p>
        ) : (
          <div className="table-scroll" style={{ marginTop: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
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
                {lignes.map((a) => (
                  <tr key={a.key} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                    <td style={{ padding: "6px 6px" }}>{a.dateLabel}</td>
                    <td style={{ padding: "6px 6px" }}>{a.horaire}</td>
                    <td style={{ padding: "6px 6px" }}>{a.type}</td>
                    <td style={{ padding: "6px 6px", color: "#7F7F7F" }}>{a.commentaire}</td>
                    <td style={{ padding: "6px 6px", textAlign: "right" }}>{a.dureeLabel}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 600 }}>
                  <td colSpan={4} style={{ padding: "8px 6px" }}>Total</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{formatHM(totalLignes)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
