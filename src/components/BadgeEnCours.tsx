"use client";

import { useEffect, useMemo, useState } from "react";
import { badgeTerminer, badgeAnnuler } from "@/app/badge/actions";

type Type = { id: string; categorie: string; objet: string; detail: string | null };

function nowWall(): number {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
}

export default function BadgeEnCours({
  id,
  clientNom,
  debutISO,
  debutLabel,
  types,
}: {
  id: string;
  clientNom: string;
  debutISO: string;
  debutLabel: string;
  types: Type[];
}) {
  const debut = new Date(debutISO).getTime();
  const [chrono, setChrono] = useState("00:00:00");
  const [typeId, setTypeId] = useState("");

  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.floor((nowWall() - debut) / 1000));
      const hh = String(Math.floor(s / 3600)).padStart(2, "0");
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      setChrono(`${hh}:${mm}:${ss}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [debut]);

  const detail = useMemo(() => types.find((t) => t.id === typeId)?.detail ?? null, [types, typeId]);

  const field = { width: "100%", fontSize: 16, padding: "13px 12px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 10, background: "#fff", color: "#595959", boxSizing: "border-box" as const };
  const label = { fontSize: 13, color: "#7F7F7F", marginBottom: 5, display: "block" } as const;

  return (
    <div>
      {/* Chrono en cours */}
      <div style={{ background: "#eef7e1", border: "1px solid #cfe8a8", borderRadius: 16, padding: "22px 18px", textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: "#5f8e2a", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>En cours</div>
        <div style={{ fontSize: 19, fontWeight: 700, color: "#595959", margin: "6px 0 2px" }}>{clientNom}</div>
        <div style={{ fontSize: 44, fontWeight: 700, color: "#5f8e2a", fontVariantNumeric: "tabular-nums", letterSpacing: "1px" }}>{chrono}</div>
        <div style={{ fontSize: 13, color: "#7F7F7F", marginTop: 4 }}>Depuis {debutLabel}</div>
      </div>

      {/* Formulaire de fin */}
      <form action={badgeTerminer}>
        <input type="hidden" name="id" value={id} />
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Type de mission</label>
          <select name="missionTypeId" value={typeId} onChange={(e) => setTypeId(e.target.value)} style={field}>
            <option value="">— Choisir un type —</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.categorie} › {t.objet}</option>
            ))}
          </select>
        </div>
        {detail && (
          <div style={{ background: "#f2f4f5", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "#7F7F7F", marginBottom: 14 }}>
            <b style={{ color: "#595959" }}>Détail :</b> {detail}
          </div>
        )}
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Commentaire</label>
          <textarea name="commentaire" rows={3} placeholder="Ce que vous avez fait…" style={{ ...field, resize: "vertical" }} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "#595959", background: "#f2f4f5", borderRadius: 10, padding: "12px 14px", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" name="hasDeplacement" style={{ width: 18, height: 18 }} />
          <span>🚗 Frais de déplacement à saisir</span>
        </label>

        <button type="submit" style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: "linear-gradient(90deg,#92D050,#7cbf3f)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>
          ⏹ Terminer et enregistrer
        </button>
        <button type="submit" name="enchainer" value="1" style={{ width: "100%", marginTop: 10, padding: "14px", borderRadius: 12, border: "1px solid #92D050", background: "#fff", color: "#5f8e2a", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
          ⏭ Terminer et enchaîner
        </button>
      </form>

      <form action={badgeAnnuler} style={{ marginTop: 12 }}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: "transparent", color: "#b03a3a", fontSize: 13, cursor: "pointer" }}>
          Annuler cette session (sans l&apos;enregistrer)
        </button>
      </form>
    </div>
  );
}
