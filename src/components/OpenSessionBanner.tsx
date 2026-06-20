"use client";

import { useEffect, useState } from "react";
import { terminerBadgeage } from "@/app/actions";

type Props = {
  id: string;
  debutISO: string;
  client: string;
  categorie: string | null;
};

function elapsed(debut: number): string {
  const s = Math.max(0, Math.floor((Date.now() - debut) / 1000));
  const hh = Math.floor(s / 3600).toString().padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function OpenSessionBanner({ id, debutISO, client, categorie }: Props) {
  const debut = new Date(debutISO).getTime();
  const [chrono, setChrono] = useState("00:00:00");

  useEffect(() => {
    setChrono(elapsed(debut));
    const t = setInterval(() => setChrono(elapsed(debut)), 1000);
    return () => clearInterval(t);
  }, [debut]);

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
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#92D050", display: "inline-block" }} />
        <span style={{ fontSize: 13, color: "#5f8e2a" }}>
          Session en cours · {client}
          {categorie ? ` · ${categorie}` : ""}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 17, fontWeight: 600, color: "#5f8e2a" }}>{chrono}</span>
        <form action={terminerBadgeage}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            style={{ background: "#5f8e2a", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}
          >
            ■ Terminer
          </button>
        </form>
      </div>
    </div>
  );
}
