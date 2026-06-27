"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  if (path.startsWith("/acces") || path.startsWith("/login") || path.startsWith("/badge")) return null; // pages plein écran / publiques
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "12px 28px",
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,.1)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Ethik & Co" style={{ height: 40 }} />
      <nav style={{ display: "flex", gap: 6 }}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              fontSize: 14,
              padding: "8px 14px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: isActive(l.href) ? 600 : 400,
              color: isActive(l.href) ? "#0077a8" : "#7F7F7F",
              background: isActive(l.href) ? "#e0f5fe" : "transparent",
            }}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <form action={deconnexion} style={{ marginLeft: "auto" }}>
        <button
          type="submit"
          title="Se déconnecter"
          style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,.15)", background: "#fff", color: "#7F7F7F", cursor: "pointer" }}
        >
          Déconnexion
        </button>
      </form>
    </header>
  );
}
