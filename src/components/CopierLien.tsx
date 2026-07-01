"use client";

import { useState } from "react";

// Bouton « Copier » pour copier de façon fiable l'intégralité d'un texte (ici, le lien
// de consultation client) dans le presse-papier, avec repli si l'API n'est pas dispo.
export default function CopierLien({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(texte);
      ok = true;
    } catch {
      // Repli (contexte non sécurisé / navigateur ancien)
      try {
        const ta = document.createElement("textarea");
        ta.value = texte;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={copier}
      style={{
        fontSize: 13,
        fontWeight: 600,
        padding: "9px 14px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        whiteSpace: "nowrap",
        background: copie ? "#1d6f42" : "#00B0F0",
        color: "#fff",
      }}
    >
      {copie ? "✓ Copié !" : "⧉ Copier"}
    </button>
  );
}
