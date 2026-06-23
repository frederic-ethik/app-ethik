"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  id: string;
  clientId: string;
  debutISO: string;
  client: string;
  categorie: string | null;
};

// "maintenant" exprimé dans le même référentiel que le stockage (heure murale locale)
function nowWall(): number {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
}

function elapsed(debutMs: number): string {
  const s = Math.max(0, Math.floor((nowWall() - debutMs) / 1000));
  const hh = Math.floor(s / 3600).toString().padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function OpenSessionBanner({ id, clientId, debutISO, client, categorie }: Props) {
  const debut = new Date(debutISO).getTime();
  const [chrono, setChrono] = useState("00:00:00");
  const path = usePathname();

  useEffect(() => {
    const tick = () => setChrono(elapsed(debut));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [debut]);

  // Pages publiques (accès client) : pas de bandeau consultant
  if (path.startsWith("/acces")) return null;

  const btn = {
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 13,
    textDecoration: "none",
    cursor: "pointer",
    display: "inline-block",
  } as const;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "10px 28px",
        background: "#eef7e1",
        borderBottom: "1px solid rgba(0,0,0,.08)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#92D050", display: "inline-block" }} />
        <span style={{ fontSize: 13, color: "#5f8e2a" }}>
          Session en cours · {client}
          {categorie ? ` · ${categorie}` : ""}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 17, fontWeight: 600, color: "#5f8e2a" }}>{chrono}</span>
        <Link
          href={`/saisie/${id}?next=${encodeURIComponent(clientId)}`}
          title="Terminer cette activité (à la validation) et en démarrer une nouvelle avec le même client"
          style={{ ...btn, background: "#fff", color: "#5f8e2a", border: "1px solid #92D050" }}
        >
          ⇄ Changer d&apos;activité
        </Link>
        <Link
          href={`/saisie/${id}`}
          title="Terminer : le temps sera figé quand vous validerez le commentaire"
          style={{ ...btn, background: "#5f8e2a", color: "#fff", border: "1px solid #5f8e2a" }}
        >
          ■ Terminer
        </Link>
      </div>
    </div>
  );
}
