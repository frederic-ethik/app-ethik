import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { basculerClientActif } from "@/app/actions";

export const dynamic = "force-dynamic";

const TYPE_CLIENT_LABEL: Record<string, string> = {
  ESS_ASSO: "ESS · Association",
  ESS_SCOOP: "ESS · SCOP",
  SECTEUR_MARCHAND: "Secteur marchand",
  NON_FACTURABLE: "Non facturable",
  NON_FACTURE: "Non facturé",
};

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: [{ actif: "desc" }, { raisonSociale: "asc" }],
    select: {
      id: true,
      raisonSociale: true,
      typeClient: true,
      ville: true,
      cibleJoursMensuelle: true,
      actif: true,
      _count: { select: { missionTypes: true } },
    },
  });

  const actifs = clients.filter((c) => c.actif).length;
  const th = { padding: "8px 10px", fontWeight: 600, color: "#7F7F7F", fontSize: 12, textAlign: "left" as const, borderBottom: "1px solid rgba(0,0,0,.2)" };
  const td = { padding: "8px 10px", fontSize: 13, borderBottom: "1px solid rgba(0,0,0,.06)" };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: 0 }}>Clients</h1>
        <Link href="/clients/nouveau" style={{ fontSize: 14, fontWeight: 600, padding: "9px 16px", borderRadius: 8, background: "#00B0F0", color: "#fff", textDecoration: "none" }}>
          + Nouveau client
        </Link>
      </div>
      <p style={{ fontSize: 13, color: "#7F7F7F", margin: "0 0 18px" }}>
        {clients.length} client{clients.length > 1 ? "s" : ""} · {actifs} actif{actifs > 1 ? "s" : ""}. Les clients liés à des activités ne sont jamais supprimés, seulement archivés.
      </p>

      <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "8px 12px", overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>Raison sociale</th>
              <th style={th}>Type</th>
              <th style={th}>Ville</th>
              <th style={{ ...th, textAlign: "right" }}>Cible j/mois</th>
              <th style={{ ...th, textAlign: "right" }}>Missions</th>
              <th style={{ ...th, textAlign: "center" }}>Statut</th>
              <th style={{ ...th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} style={{ opacity: c.actif ? 1 : 0.55 }}>
                <td style={{ ...td, fontWeight: 600 }}>
                  <Link href={`/clients/${c.id}`} style={{ color: "#0077a8", textDecoration: "none" }}>{c.raisonSociale}</Link>
                </td>
                <td style={td}>{TYPE_CLIENT_LABEL[c.typeClient] ?? c.typeClient}</td>
                <td style={td}>{c.ville ?? "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>{c.cibleJoursMensuelle ?? "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>{c._count.missionTypes}</td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: c.actif ? "#e6f7ec" : "#f0f0f0", color: c.actif ? "#1d6f42" : "#999" }}>
                    {c.actif ? "Actif" : "Archivé"}
                  </span>
                </td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <Link href={`/clients/${c.id}`} style={{ fontSize: 13, color: "#0077a8", textDecoration: "none", marginRight: 12 }}>✎ Modifier</Link>
                  <form action={basculerClientActif} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" style={{ fontSize: 13, color: c.actif ? "#b06a00" : "#1d6f42", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      {c.actif ? "Archiver" : "Réactiver"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
