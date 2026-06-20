import "./globals.css";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import OpenSessionBanner from "@/components/OpenSessionBanner";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Ethik & Co — Temps & frais",
  description: "Gestion des temps et des frais de déplacement",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await prisma.activity.findFirst({
    where: { finAct: null },
    include: { client: true, missionType: true },
    orderBy: { debutAct: "desc" },
  });

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#eef0f2",
          color: "#595959",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        <SiteHeader />
        {session && (
          <OpenSessionBanner
            id={session.id}
            debutISO={session.debutAct.toISOString()}
            client={session.client.raisonSociale}
            categorie={session.missionType?.categorie ?? null}
          />
        )}
        <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 28px" }}>{children}</main>
      </body>
    </html>
  );
}
