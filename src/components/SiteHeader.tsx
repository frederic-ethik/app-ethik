"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tableau de bord" },
  { href: "/saisie", label: "Saisie" },
  { href: "/journal", label: "Journal" },
  { href: "/rapports", label: "Rapports" },
];

export default function SiteHeader() {
  const path = usePathname();
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
    </header>
  );
}
