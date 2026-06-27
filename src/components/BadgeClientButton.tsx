"use client";

import { useFormStatus } from "react-dom";

// Bouton « client » de l'écran de badgeage : affiche un retour visuel immédiat
// (passe en bleu « Démarrage… ») dès le tap, le temps que le serveur lance le chrono.
export default function BadgeClientButton({ nom }: { nom: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "16px 18px",
        borderRadius: 12,
        border: `1px solid ${pending ? "#00B0F0" : "rgba(0,0,0,.12)"}`,
        background: pending ? "#00B0F0" : "#fff",
        color: pending ? "#fff" : "#595959",
        fontSize: 16,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        transition: "background .1s ease, color .1s ease, border-color .1s ease",
        WebkitTapHighlightColor: "transparent",
        opacity: pending ? 1 : undefined,
      }}
    >
      <span>{nom}</span>
      <span style={{ fontSize: pending ? 14 : 20, fontWeight: 700, whiteSpace: "nowrap" }}>
        {pending ? "⏳ Démarrage…" : "▶"}
      </span>
    </button>
  );
}
