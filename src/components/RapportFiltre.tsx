"use client";

import { useState } from "react";

type ClientOpt = { id: string; raisonSociale: string; actif: boolean };

const field = { fontSize: 14, padding: "8px 10px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8, background: "#fff", color: "#595959" } as const;

export default function RapportFiltre({
  clients,
  clientId,
  mode: modeInitial,
  mois,
  debut,
  fin,
}: {
  clients: ClientOpt[];
  clientId: string;
  mode: "mois" | "periode";
  mois: string; // YYYY-MM
  debut: string; // YYYY-MM-DD
  fin: string; // YYYY-MM-DD
}) {
  const [mode, setMode] = useState<"mois" | "periode">(modeInitial);

  const seg = (actif: boolean) =>
    ({
      fontSize: 13,
      padding: "8px 14px",
      border: "1px solid rgba(0,0,0,.2)",
      cursor: "pointer",
      background: actif ? "#00B0F0" : "#fff",
      color: actif ? "#fff" : "#595959",
      fontWeight: actif ? 600 : 400,
    }) as const;

  return (
    <form method="get" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div>
        <label style={{ fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 3 }}>Client</label>
        <select name="client" defaultValue={clientId} style={{ ...field, minWidth: 230 }}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.raisonSociale}{c.actif ? "" : " (archivé)"}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 3 }}>Vue</label>
        <input type="hidden" name="mode" value={mode} />
        <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden" }}>
          <button type="button" onClick={() => setMode("mois")} style={{ ...seg(mode === "mois"), borderRadius: "8px 0 0 8px", borderRight: "none" }}>Mois</button>
          <button type="button" onClick={() => setMode("periode")} style={{ ...seg(mode === "periode"), borderRadius: "0 8px 8px 0" }}>Période</button>
        </div>
      </div>

      {mode === "mois" ? (
        <div>
          <label style={{ fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 3 }}>Mois (le plus récent affiché)</label>
          <input type="month" name="mois" defaultValue={mois} style={field} />
        </div>
      ) : (
        <>
          <div>
            <label style={{ fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 3 }}>Du</label>
            <input type="date" name="debut" defaultValue={debut} style={field} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 3 }}>Au</label>
            <input type="date" name="fin" defaultValue={fin} style={field} />
          </div>
        </>
      )}

      <button type="submit" style={{ ...field, cursor: "pointer" }}>Afficher</button>
    </form>
  );
}
