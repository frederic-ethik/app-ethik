"use client";

import { useState } from "react";
import { minToHHMM } from "@/lib/demi-journees";

const dureeLabel = (m: number) => {
  const h = Math.floor(m / 60);
  const mn = m % 60;
  if (h && mn) return `${h} h ${mn} min`;
  if (h) return `${h} h`;
  return `${mn} min`;
};

export default function ReglesDemiJournee({
  matinFin,
  apremDebut,
  seuil,
}: {
  matinFin: number;
  apremDebut: number;
  seuil: number;
}) {
  const [mf, setMf] = useState(matinFin);
  const [ad, setAd] = useState(apremDebut);
  const [se, setSe] = useState(seuil);

  const row = { display: "grid", gridTemplateColumns: "200px 1fr 90px", alignItems: "center", gap: 14, marginBottom: 16 } as const;
  const lbl = { fontSize: 13, color: "#595959" } as const;
  const val = { fontSize: 15, fontWeight: 600, color: "#0077a8", textAlign: "right" as const };
  const slider = { width: "100%", accentColor: "#00B0F0" } as const;

  return (
    <div>
      <div style={row}>
        <div>
          <div style={lbl}>Fin de la plage du matin</div>
          <div style={{ fontSize: 11, color: "#a5a5a5" }}>Le matin = avant cette heure</div>
        </div>
        <input name="demiJMatinFin" type="range" min={600} max={900} step={15} value={mf} onChange={(e) => setMf(Number(e.target.value))} style={slider} />
        <div style={val}>{minToHHMM(mf)}</div>
      </div>

      <div style={row}>
        <div>
          <div style={lbl}>Début de la plage de l&apos;après-midi</div>
          <div style={{ fontSize: 11, color: "#a5a5a5" }}>L&apos;après-midi = après cette heure</div>
        </div>
        <input name="demiJApremDebut" type="range" min={600} max={900} step={15} value={ad} onChange={(e) => setAd(Number(e.target.value))} style={slider} />
        <div style={val}>{minToHHMM(ad)}</div>
      </div>

      <div style={row}>
        <div>
          <div style={lbl}>Seuil d&apos;une demi-journée</div>
          <div style={{ fontSize: 11, color: "#a5a5a5" }}>Temps mini à dépasser dans une plage</div>
        </div>
        <input name="demiJSeuil" type="range" min={0} max={240} step={15} value={se} onChange={(e) => setSe(Number(e.target.value))} style={slider} />
        <div style={val}>{dureeLabel(se)}</div>
      </div>

      <div style={{ background: ad < mf ? "#eef7ff" : "#fff7e6", border: `1px solid ${ad < mf ? "#cfe8fb" : "#f0d9a0"}`, borderRadius: 8, padding: "10px 13px", fontSize: 12.5, color: "#595959", lineHeight: 1.5 }}>
        {ad < mf ? (
          <>
            Une <strong>demi-journée</strong> est comptée dès qu&apos;on travaille <strong>plus de {dureeLabel(se)}</strong> sur une plage.
            Entre <strong>{minToHHMM(ad)}</strong> et <strong>{minToHHMM(mf)}</strong> (zone commune), le temps est attribué <em>en entier</em> au matin ou à l&apos;après-midi — jamais aux deux.
            Un jour vaut ainsi <strong>0</strong>, <strong>0,5</strong> ou <strong>1</strong> journée.
          </>
        ) : (
          <>⚠ L&apos;heure de début de l&apos;après-midi ({minToHHMM(ad)}) est après la fin du matin ({minToHHMM(mf)}) : le temps situé entre les deux ne serait compté nulle part. Pensez à faire chevaucher les deux plages.</>
        )}
      </div>
    </div>
  );
}
