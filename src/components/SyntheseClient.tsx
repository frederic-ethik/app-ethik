"use client";

import { useState } from "react";
import { validerSynthese, genererSynthese } from "@/app/actions";

export default function SyntheseClient({
  clientId,
  annee,
  mois,
  initial,
}: {
  clientId: string;
  annee: number;
  mois: number;
  initial: string;
}) {
  const [texte, setTexte] = useState(initial);
  const [copied, setCopied] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponible */
    }
  };

  const btn = {
    fontSize: 13,
    padding: "8px 13px",
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,.2)",
    background: "#fff",
    color: "#595959",
    cursor: "pointer",
    fontFamily: "inherit",
  } as const;

  return (
    <div>
      <form action={validerSynthese}>
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="annee" value={annee} />
        <input type="hidden" name="mois" value={mois} />
        <textarea
          name="texte"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={10}
          style={{
            width: "100%",
            fontSize: 14,
            lineHeight: 1.6,
            padding: "12px 14px",
            border: "1px solid #00B0F0",
            borderRadius: 8,
            background: "#fff",
            color: "#595959",
            resize: "vertical",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="submit" style={{ ...btn, background: "linear-gradient(90deg,#92D050,#7cbf3f)", color: "#fff", border: "none", fontWeight: 600 }}>
            ✓ Enregistrer
          </button>
          <button type="button" onClick={copier} style={{ ...btn, background: "#00B0F0", color: "#fff", border: "none" }}>
            {copied ? "✓ Copié !" : "⧉ Copier tout"}
          </button>
        </div>
      </form>

      <form action={genererSynthese} style={{ marginTop: 8 }}>
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="annee" value={annee} />
        <input type="hidden" name="mois" value={mois} />
        <button type="submit" style={btn}>↻ Régénérer avec l&apos;IA</button>
      </form>
    </div>
  );
}
