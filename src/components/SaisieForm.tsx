"use client";

import { useMemo, useState } from "react";
import { createActivite, startBadgeage } from "@/app/actions";
import { dureeHeures, formatHeures } from "@/lib/format";

type Client = { id: string; raisonSociale: string };
type Type = { id: string; clientId: string; categorie: string; objet: string; detail: string | null };

export default function SaisieForm({
  clients,
  types,
  today,
}: {
  clients: Client[];
  types: Type[];
  today: string;
}) {
  const [mode, setMode] = useState<"badgeage" | "rattrapage">("rattrapage");
  const [clientId, setClientId] = useState("");
  const [missionTypeId, setMissionTypeId] = useState("");
  const [debut, setDebut] = useState("09:00");
  const [fin, setFin] = useState("10:00");

  const typesClient = useMemo(
    () => types.filter((t) => t.clientId === clientId),
    [types, clientId]
  );
  const detail = useMemo(
    () => types.find((t) => t.id === missionTypeId)?.detail ?? null,
    [types, missionTypeId]
  );
  const duree = mode === "rattrapage" ? dureeHeures(debut, fin) : 0;

  const label = { fontSize: 12, color: "#7F7F7F", marginBottom: 3, display: "block" } as const;
  const field = {
    width: "100%",
    fontSize: 14,
    padding: "9px 10px",
    border: "1px solid rgba(0,0,0,.2)",
    borderRadius: 8,
    background: "#fff",
    color: "#595959",
    boxSizing: "border-box" as const,
  };

  return (
    <form action={mode === "badgeage" ? startBadgeage : createActivite}>
      {/* Bascule de mode */}
      <div style={{ display: "flex", gap: 6, background: "#f2f4f5", padding: 4, borderRadius: 8, marginBottom: 18 }}>
        {(["badgeage", "rattrapage"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              fontSize: 13,
              padding: "8px",
              borderRadius: 6,
              border: mode === m ? "1px solid rgba(0,0,0,.1)" : "1px solid transparent",
              background: mode === m ? "#fff" : "transparent",
              color: mode === m ? "#595959" : "#7F7F7F",
              cursor: "pointer",
              fontWeight: mode === m ? 600 : 400,
            }}
          >
            {m === "badgeage" ? "Badgeage (chrono)" : "Rattrapage (saisie manuelle)"}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label}>Client</label>
        <select
          name="clientId"
          required
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setMissionTypeId("");
          }}
          style={field}
        >
          <option value="">— Choisir un client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.raisonSociale}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label}>Type de mission</label>
        <select
          name="missionTypeId"
          value={missionTypeId}
          onChange={(e) => setMissionTypeId(e.target.value)}
          disabled={!clientId}
          style={{ ...field, opacity: clientId ? 1 : 0.6 }}
        >
          <option value="">{clientId ? "— Choisir un type —" : "Choisissez d'abord un client"}</option>
          {typesClient.map((t) => (
            <option key={t.id} value={t.id}>
              {t.categorie} › {t.objet}
            </option>
          ))}
        </select>
      </div>

      {detail && (
        <div style={{ background: "#f2f4f5", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#7F7F7F", marginBottom: 12 }}>
          <b style={{ color: "#595959" }}>Détail :</b> {detail}
        </div>
      )}

      {mode === "rattrapage" ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Date</label>
            <input type="date" name="date" defaultValue={today} required style={field} />
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Début</label>
              <input type="time" name="debut" value={debut} onChange={(e) => setDebut(e.target.value)} required style={field} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Fin</label>
              <input type="time" name="fin" value={fin} onChange={(e) => setFin(e.target.value)} required style={field} />
            </div>
          </div>
          <div style={{ background: "#e0f5fe", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#0077a8", marginBottom: 12 }}>
            Durée : {formatHeures(duree)}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label}>Commentaire</label>
            <textarea name="commentaire" rows={2} placeholder="Dictée vocale possible sur mobile…" style={{ ...field, resize: "vertical" }} />
          </div>
          <button
            type="submit"
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "linear-gradient(90deg,#92D050,#7cbf3f)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Enregistrer l'activité
          </button>
        </>
      ) : (
        <button
          type="submit"
          style={{ width: "100%", padding: "22px", borderRadius: 12, border: "none", background: "linear-gradient(90deg,#92D050,#7cbf3f)", color: "#fff", fontSize: 20, fontWeight: 600, cursor: "pointer" }}
        >
          ▶ DÉMARRER
        </button>
      )}
    </form>
  );
}
