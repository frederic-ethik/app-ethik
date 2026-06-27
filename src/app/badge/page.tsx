import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { heureDe } from "@/lib/format";
import { badgeDemarrer } from "@/app/badge/actions";
import BadgeEnCours from "@/components/BadgeEnCours";

export const dynamic = "force-dynamic";

export default async function BadgePage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;

  const session = await prisma.activity.findFirst({
    where: { finAct: null },
    include: { client: true },
    orderBy: { debutAct: "desc" },
  });

  const types = session
    ? await prisma.missionType.findMany({
        where: { clientId: session.clientId, actif: true },
        orderBy: [{ categorie: "asc" }, { objet: "asc" }],
        select: { id: true, categorie: true, objet: true, detail: true },
      })
    : [];

  const clients = session
    ? []
    : await prisma.client.findMany({
        where: { actif: true },
        orderBy: { raisonSociale: "asc" },
        select: { id: true, raisonSociale: true },
      });

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      {/* En-tête minimal */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Ethik & Co" style={{ height: 38 }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: "#595959" }}>Badgeage</span>
        </div>
        <Link href="/" style={{ fontSize: 13, color: "#0077a8", textDecoration: "none" }}>Gestion ›</Link>
      </div>

      {sp.ok && !session && (
        <div style={{ background: "#eef7e1", color: "#5f8e2a", borderRadius: 10, padding: "11px 14px", fontSize: 14, marginBottom: 16, textAlign: "center" }}>
          ✓ Activité enregistrée.
        </div>
      )}

      {session ? (
        <BadgeEnCours
          id={session.id}
          clientNom={session.client.raisonSociale}
          debutISO={session.debutAct.toISOString()}
          debutLabel={heureDe(session.debutAct)}
          types={types}
        />
      ) : (
        <>
          <p style={{ fontSize: 15, color: "#595959", fontWeight: 600, margin: "0 0 4px" }}>Démarrer une activité</p>
          <p style={{ fontSize: 13, color: "#7F7F7F", margin: "0 0 16px" }}>Choisissez un client : le chrono démarre aussitôt.</p>
          {clients.length === 0 ? (
            <p style={{ fontSize: 14, color: "#a5a5a5" }}>Aucun client actif.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {clients.map((c) => (
                <form key={c.id} action={badgeDemarrer}>
                  <input type="hidden" name="clientId" value={c.id} />
                  <button
                    type="submit"
                    style={{ width: "100%", textAlign: "left", padding: "16px 18px", borderRadius: 12, border: "1px solid rgba(0,0,0,.12)", background: "#fff", color: "#595959", fontSize: 16, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <span>{c.raisonSociale}</span>
                    <span style={{ color: "#00B0F0", fontSize: 20 }}>▶</span>
                  </button>
                </form>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
