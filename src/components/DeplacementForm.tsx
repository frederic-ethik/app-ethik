"use client";

import { useState } from "react";
import { enregistrerDeplacement } from "@/app/actions";
import { indemniteKm, type Bareme } from "@/lib/bareme";

type Vehicule = "" | "NISSAN_ARIYA_3CV" | "VW_SHARAN_8CV";

type Init = {
  date: string;
  description: string;
  vehicule: Vehicule;
  lieuDepart: string;
  lieuArrivee: string;
  kmAller: string;
  kmRetour: string;
  fraisTransport: string;
  fraisParking: string;
  fraisRepas: string;
  fraisHotel: string;
  fraisDivers: string;
  moyenPaiement: string;
};

const num = (s: string) => {
  const v = parseFloat(s.replace(",", "."));
  return Number.isNaN(v) ? 0 : v;
};
const eur = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function DeplacementForm({
  activityId,
  init,
  baremes,
  cumul,
}: {
  activityId: string;
  init: Init;
  baremes: { NISSAN_ARIYA_3CV: Bareme; VW_SHARAN_8CV: Bareme };
  cumul: { NISSAN_ARIYA_3CV: number; VW_SHARAN_8CV: number };
}) {
  const [f, setF] = useState<Init>(init);
  const set = (k: keyof Init) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const kmTotal = f.vehicule ? num(f.kmAller) + num(f.kmRetour) : 0;
  const indemnite = f.vehicule ? indemniteKm(baremes[f.vehicule], kmTotal, cumul[f.vehicule]) : 0;
  const fraisSomme = num(f.fraisTransport) + num(f.fraisParking) + num(f.fraisRepas) + num(f.fraisHotel) + num(f.fraisDivers);
  const total = Math.round((indemnite + fraisSomme) * 100) / 100;

  const label = { fontSize: 12, color: "#7F7F7F", marginBottom: 3, display: "block" } as const;
  const field = { width: "100%", fontSize: 14, padding: "9px 10px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8, background: "#fff", color: "#595959", boxSizing: "border-box" as const };
  const row = { display: "flex", gap: 12, marginBottom: 12 } as const;

  return (
    <form action={enregistrerDeplacement}>
      <input type="hidden" name="activityId" value={activityId} />

      <div style={{ marginBottom: 12 }}>
        <label style={label}>Description</label>
        <input type="text" name="description" value={f.description} onChange={set("description")} placeholder="ex. Journée avec Laureline" style={field} />
      </div>

      <div style={row}>
        <div style={{ flex: 1 }}>
          <label style={label}>Date du déplacement</label>
          <input type="date" name="date" value={f.date} onChange={set("date")} required style={field} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Moyen de paiement</label>
          <select name="moyenPaiement" value={f.moyenPaiement} onChange={set("moyenPaiement")} style={field}>
            <option value="">—</option>
            <option value="CARTE">Carte</option>
            <option value="ESPECES">Espèces</option>
            <option value="CHEQUE">Chèque</option>
            <option value="NC">NC</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label}>Véhicule</label>
        <select name="vehicule" value={f.vehicule} onChange={set("vehicule")} style={field}>
          <option value="">Aucun (transport en commun)</option>
          <option value="NISSAN_ARIYA_3CV">Nissan Ariya VE — 3 CV (électrique +20 %)</option>
          <option value="VW_SHARAN_8CV">VW Sharan Diesel — 8 CV</option>
        </select>
      </div>

      {f.vehicule && (
        <>
          <div style={row}>
            <div style={{ flex: 1 }}>
              <label style={label}>Lieu de départ</label>
              <input type="text" name="lieuDepart" value={f.lieuDepart} onChange={set("lieuDepart")} style={field} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Lieu d&apos;arrivée</label>
              <input type="text" name="lieuArrivee" value={f.lieuArrivee} onChange={set("lieuArrivee")} style={field} />
            </div>
          </div>
          <div style={row}>
            <div style={{ flex: 1 }}>
              <label style={label}>km aller</label>
              <input type="number" inputMode="numeric" name="kmAller" value={f.kmAller} onChange={set("kmAller")} style={field} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>km retour</label>
              <input type="number" inputMode="numeric" name="kmRetour" value={f.kmRetour} onChange={set("kmRetour")} style={field} />
            </div>
          </div>
          <div style={{ background: "#eef7e1", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#5f8e2a", marginBottom: 14 }}>
            Indemnité km : <b>{kmTotal} km × barème URSSAF = {eur(indemnite)}</b>
            <span style={{ color: "#7F7F7F", fontSize: 11 }}> (cumul annuel pris en compte)</span>
          </div>
        </>
      )}

      <div style={{ fontSize: 12, fontWeight: 600, color: "#7F7F7F", margin: "4px 0 8px" }}>Frais (montants HT €)</div>
      <div style={row}>
        <div style={{ flex: 1 }}><label style={label}>Transport</label><input type="number" inputMode="decimal" name="fraisTransport" value={f.fraisTransport} onChange={set("fraisTransport")} style={field} /></div>
        <div style={{ flex: 1 }}><label style={label}>Parking / Péage</label><input type="number" inputMode="decimal" name="fraisParking" value={f.fraisParking} onChange={set("fraisParking")} style={field} /></div>
      </div>
      <div style={row}>
        <div style={{ flex: 1 }}><label style={label}>Repas</label><input type="number" inputMode="decimal" name="fraisRepas" value={f.fraisRepas} onChange={set("fraisRepas")} style={field} /></div>
        <div style={{ flex: 1 }}><label style={label}>Hôtel</label><input type="number" inputMode="decimal" name="fraisHotel" value={f.fraisHotel} onChange={set("fraisHotel")} style={field} /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={label}>Divers</label>
        <input type="number" inputMode="decimal" name="fraisDivers" value={f.fraisDivers} onChange={set("fraisDivers")} style={field} />
      </div>

      <div style={{ background: "#e0f5fe", borderRadius: 8, padding: "11px 13px", fontSize: 16, color: "#0077a8", fontWeight: 600, marginBottom: 16 }}>
        Total déplacement : {eur(total)}
      </div>

      <p style={{ fontSize: 11, color: "#a5a5a5", margin: "0 0 14px" }}>
        📎 L&apos;ajout de justificatifs (photos / PDF) arrivera avec le stockage cloud (étape ultérieure).
      </p>

      <button type="submit" style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "linear-gradient(90deg,#92D050,#7cbf3f)", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
        Enregistrer le déplacement
      </button>
    </form>
  );
}
