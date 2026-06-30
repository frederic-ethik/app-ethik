"use client";

import { useState } from "react";
import { genererSynthesePeriode } from "@/app/actions";
import { SYNTHESE_PERIODE_ID } from "@/components/RapportExports";

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

export default function SynthesePeriode({
  clientId,
  debut,
  fin,
}: {
  clientId: string;
  debut: string; // YYYY-MM-DD
  fin: string; // YYYY-MM-DD
}) {
  const [texte, setTexte] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  const [copied, setCopied] = useState(false);

  const generer = async () => {
    setLoading(true);
    setErreur("");
    try {
      const t = await genererSynthesePeriode(clientId, debut, fin);
      setTexte(t);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Échec de la génération.");
    } finally {
      setLoading(false);
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponible */
    }
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "#7F7F7F", margin: "0 0 12px" }}>
        ✨ Génère un résumé narratif <strong>de la période sélectionnée</strong> à partir de vos commentaires, à corriger puis copier-coller dans votre email au client. (Non enregistré — pensez à copier ou exporter.)
      </p>

      <button type="button" onClick={generer} disabled={loading} style={{ ...btn, background: "linear-gradient(90deg,#92D050,#7cbf3f)", color: "#fff", border: "none", fontWeight: 600, opacity: loading ? 0.6 : 1, cursor: loading ? "default" : "pointer" }}>
        {loading ? "⏳ Génération…" : texte ? "↻ Régénérer avec l'IA" : "✨ Générer la synthèse"}
      </button>

      {erreur && (
        <div style={{ background: "#fdecea", color: "#b3261e", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginTop: 12 }}>
          {erreur}
        </div>
      )}

      {texte && (
        <div style={{ marginTop: 12 }}>
          <textarea
            id={SYNTHESE_PERIODE_ID}
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
            <button type="button" onClick={copier} style={{ ...btn, background: "#00B0F0", color: "#fff", border: "none" }}>
              {copied ? "✓ Copié !" : "⧉ Copier tout"}
            </button>
            <span style={{ fontSize: 12, color: "#7F7F7F" }}>
              ↑ Les boutons <strong>PDF / Excel</strong> en haut de page intègrent cette synthèse.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
