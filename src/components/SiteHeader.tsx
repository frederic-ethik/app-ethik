"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { deconnexion } from "@/app/actions-auth";

const LINKS = [
  { href: "/", label: "Tableau de bord" },
  { href: "/saisie", label: "Saisie" },
  { href: "/journal", label: "Journal" },
  { href: "/rapports", label: "Rapports" },
  { href: "/note-frais", label: "Note de frais" },
  { href: "/clients", label: "Clients" },
  { href: "/reglages", label: "Réglages" },
];

export default function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path.startsWith("/acces") || path.startsWith("/login") || path.startsWith("/badge")) return null;
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const linkStyle = (active: boolean) => ({
    fontSize: 14,
    padding: "8px 14px",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: active ? 600 : 400,
    color: active ? "#0077a8" : "#7F7F7F",
    background: active ? "#e0f5fe" : "transparent",
    display: "block",
  } as const);

  const logoutStyle = { fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,.15)", background: "#fff", color: "#7F7F7F", cursor: "pointer" } as const;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 20px",
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,.1)",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Ethik & Co" style={{ height: 38 }} />

      {/* Navigation bureau */}
      <nav className="nav-desktop">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} style={linkStyle(isActive(l.href))}>{l.label}</Link>
        ))}
        <form action={deconnexion} style={{ marginLeft: "auto" }}>
          <button type="submit" style={logoutStyle}>Déconnexion</button>
        </form>
      </nav>

      {/* Menu mobile (sandwich) */}
      <div className="nav-burger" style={{ marginLeft: "auto", position: "relative" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={open}
          style={{ fontSize: 26, lineHeight: 1, background: "none", border: "none", color: "#595959", cursor: "pointer", padding: "2px 6px" }}
        >
          {open ? "✕" : "☰"}
        </button>
        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              background: "#fff",
              border: "1px solid rgba(0,0,0,.12)",
              borderRadius: 12,
              boxShadow: "0 10px 28px rgba(0,0,0,.14)",
              padding: 8,
              minWidth: 210,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{ ...linkStyle(isActive(l.href)), fontSize: 15, padding: "11px 14px" }}>
                {l.label}
              </Link>
            ))}
            <form action={deconnexion} style={{ marginTop: 4, borderTop: "1px solid rgba(0,0,0,.08)", paddingTop: 6 }}>
              <button type="submit" style={{ width: "100%", textAlign: "left", fontSize: 15, padding: "11px 14px", borderRadius: 8, border: "none", background: "none", color: "#7F7F7F", cursor: "pointer" }}>
                Déconnexion
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
