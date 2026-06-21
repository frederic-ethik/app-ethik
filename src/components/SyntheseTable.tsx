"use client";

import { useEffect, useRef, useState } from "react";
import { formatHM } from "@/lib/format";

type Month = { key: string; label: string };
type RowD = { key: string; cat: string; obj: string; moy: number; per: number[] };

const stickyLeft = { position: "sticky" as const, left: 0, background: "#fff" };
const FIRST_COL = 180; // largeur approx. colonne Catégorie/Objet
const MOY_COL = 54;
const MONTH_COL = 60;

export default function SyntheseTable({
  selKey,
  months,
  rows,
  totalRow,
  facturesRow,
  joursRow,
  moyTotal,
}: {
  selKey: string;
  months: Month[];
  rows: RowD[];
  totalRow: number[];
  facturesRow: (number | null)[];
  joursRow: number[];
  moyTotal: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(Math.min(6, months.length));

  useEffect(() => {
    const calc = () => {
      const w = ref.current?.clientWidth ?? 700;
      const cols = Math.floor((w - FIRST_COL - MOY_COL) / MONTH_COL);
      setN(Math.max(1, Math.min(cols, months.length)));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [months.length]);

  const ms = months.slice(0, n);
  const hl = (key: string, base?: string) => (key === selKey ? "#f3fbff" : base);

  return (
    <div ref={ref} style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
        <thead>
          <tr style={{ color: "#7F7F7F" }}>
            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,.2)", ...stickyLeft }}>Catégorie / Objet</th>
            <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,.2)" }}>Moy.</th>
            {ms.map((mm) => (
              <th key={mm.key} style={{ textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap", borderBottom: "1px solid rgba(0,0,0,.2)", color: mm.key === selKey ? "#0077a8" : "#7F7F7F", fontWeight: mm.key === selKey ? 600 : 400 }}>
                {mm.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={n + 2} style={{ padding: "12px 8px", color: "#a5a5a5" }}>Aucune activité.</td></tr>
          ) : (
            rows.map((r) => (
              <tr key={r.key} style={{ borderBottom: "1px solid rgba(0,0,0,.06)" }}>
                <td style={{ padding: "6px 8px", ...stickyLeft }}>
                  <span style={{ fontWeight: 600 }}>{r.cat}</span><span style={{ color: "#7F7F7F" }}> › {r.obj}</span>
                </td>
                <td style={{ padding: "6px 8px", textAlign: "right", color: "#7F7F7F" }}>{formatHM(r.moy)}</td>
                {ms.map((mm, i) => (
                  <td key={mm.key} style={{ padding: "6px 8px", textAlign: "right", background: hl(mm.key) }}>{formatHM(r.per[i])}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 600, borderTop: "2px solid rgba(0,0,0,.15)" }}>
            <td style={{ padding: "7px 8px", ...stickyLeft }}>Total (heures)</td>
            <td style={{ padding: "7px 8px", textAlign: "right" }}>{formatHM(moyTotal)}</td>
            {ms.map((mm, i) => (
              <td key={mm.key} style={{ padding: "7px 8px", textAlign: "right", background: mm.key === selKey ? "#e9f6ff" : undefined }}>{formatHM(totalRow[i])}</td>
            ))}
          </tr>
          <tr style={{ fontWeight: 600, color: "#5f8e2a", background: "#f6fbef" }}>
            <td style={{ padding: "6px 8px", ...stickyLeft, color: "#5f8e2a", background: "#f6fbef" }}>Jours facturés</td>
            <td style={{ padding: "6px 8px" }}></td>
            {ms.map((mm, i) => (
              <td key={mm.key} style={{ padding: "6px 8px", textAlign: "right", background: mm.key === selKey ? "#eef7e1" : undefined }}>{facturesRow[i] != null ? facturesRow[i]!.toLocaleString("fr-FR") : "–"}</td>
            ))}
          </tr>
          <tr style={{ color: "#7F7F7F" }}>
            <td style={{ padding: "5px 8px", ...stickyLeft, color: "#7F7F7F" }}>Moyenne / jour facturé</td>
            <td style={{ padding: "5px 8px" }}></td>
            {ms.map((mm, i) => {
              const j = facturesRow[i];
              return <td key={mm.key} style={{ padding: "5px 8px", textAlign: "right", background: mm.key === selKey ? "#f6fbef" : undefined }}>{j ? formatHM(totalRow[i] / j) : "–"}</td>;
            })}
          </tr>
          <tr style={{ color: "#a5a5a5", fontSize: 11 }}>
            <td style={{ padding: "4px 8px", ...stickyLeft, color: "#a5a5a5" }}>Jours travaillés (indicatif)</td>
            <td style={{ padding: "4px 8px" }}></td>
            {ms.map((mm, i) => (
              <td key={mm.key} style={{ padding: "4px 8px", textAlign: "right" }}>{joursRow[i].toLocaleString("fr-FR")}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
