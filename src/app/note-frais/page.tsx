import { prisma } from "@/lib/prisma";
import { getNoteFraisData } from "@/lib/note-frais-data";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const eur = (n: number) => (n ? n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "—");

export default async function NoteFraisPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; debut?: string; fin?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  const clients = await prisma.client.findMany({ orderBy: { raisonSociale: "asc" }, select: { id: true, raisonSociale: true, actif: true } });
  const client = sp.client || clients.find((c) => c.actif)?.id || clients[0]?.id || "tous";
  const debut = sp.debut || `${y}-${pad(m + 1)}-01`;
  const fin = sp.fin || `${y}-${pad(m + 1)}-${pad(new Date(Date.UTC(y, m + 1, 0)).getUTCDate())}`;

  const data = await getNoteFraisData(client, debut, fin);
  const q = `client=${encodeURIComponent(client)}&debut=${debut}&fin=${fin}`;

  const field = { fontSize: 14, padding: "8px 10px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8, background: "#fff", color: "#595959" } as const;
  const card = { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "18px 20px", marginBottom: 22 } as const;
  const th = { padding: "6px 6px", fontWeight: 600, color: "#7F7F7F", fontSize: 12, textAlign: "left" as const, borderBottom: "1px solid rgba(0,0,0,.2)" };
  const td = { padding: "5px 6px", fontSize: 12, borderBottom: "1px solid rgba(0,0,0,.06)" };
  const dlBtn = { fontSize: 14, padding: "10px 16px", borderRadius: 8, textDecoration: "none", fontWeight: 600 } as const;

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: "0 0 14px" }}>Note de frais</h1>

      <form method="get" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 3 }}>Client</label>
          <select name="client" defaultValue={client} style={{ ...field, minWidth: 220 }}>
            <option value="tous">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.raisonSociale}{c.actif ? "" : " (archivé)"}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 3 }}>Du</label>
          <input type="date" name="debut" defaultValue={debut} style={field} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 3 }}>Au</label>
          <input type="date" name="fin" defaultValue={fin} style={field} />
        </div>
        <button type="submit" style={{ ...field, cursor: "pointer" }}>Afficher</button>
        <span style={{ flex: 1 }} />
        {data.lignes.length > 0 && (
          <>
            <a href={`/api/note-frais?${q}`} style={{ ...dlBtn, background: "#00B0F0", color: "#fff" }}>⬇ PDF</a>
            <a href={`/api/note-frais-excel?${q}`} style={{ ...dlBtn, background: "#1D6F42", color: "#fff" }}>⬇ Excel</a>
          </>
        )}
      </form>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#7F7F7F" }}>{data.clientLabel} · {data.periodeLabel}</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#0077a8" }}>Total : {eur(data.total)}</span>
        </div>

        {data.lignes.length === 0 ? (
          <p style={{ fontSize: 14, color: "#a5a5a5" }}>Aucun déplacement sur cette période.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    {data.multiClient && <th style={th}>Client</th>}
                    <th style={th}>Nature</th>
                    <th style={{ ...th, textAlign: "right" }}>km</th>
                    <th style={{ ...th, textAlign: "right" }}>Comp. km</th>
                    <th style={{ ...th, textAlign: "right" }}>Transp.</th>
                    <th style={{ ...th, textAlign: "right" }}>Park/Péage</th>
                    <th style={{ ...th, textAlign: "right" }}>Repas</th>
                    <th style={{ ...th, textAlign: "right" }}>Hôtel</th>
                    <th style={{ ...th, textAlign: "right" }}>Divers</th>
                    <th style={{ ...th, textAlign: "right" }}>S-total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lignes.map((l, i) => (
                    <tr key={i}>
                      <td style={td}>{l.date}</td>
                      {data.multiClient && <td style={td}>{l.client}</td>}
                      <td style={td}>{l.nature}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {l.km ? Math.round(l.km) : ""}
                        {l.marker ? <sup style={{ color: "#0077a8" }}> ({l.marker})</sup> : null}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{eur(l.compensation)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{eur(l.transport)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{eur(l.parking)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{eur(l.repas)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{eur(l.hotel)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{eur(l.divers)}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{eur(l.stotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 600 }}>
                    <td style={{ ...td, borderTop: "2px solid rgba(0,0,0,.15)" }} colSpan={data.multiClient ? 5 : 4}>TOTAUX</td>
                    <td style={{ ...td, textAlign: "right", borderTop: "2px solid rgba(0,0,0,.15)" }}>{eur(data.totaux.compensation)}</td>
                    <td style={{ ...td, textAlign: "right", borderTop: "2px solid rgba(0,0,0,.15)" }}>{eur(data.totaux.transport)}</td>
                    <td style={{ ...td, textAlign: "right", borderTop: "2px solid rgba(0,0,0,.15)" }}>{eur(data.totaux.parking)}</td>
                    <td style={{ ...td, textAlign: "right", borderTop: "2px solid rgba(0,0,0,.15)" }}>{eur(data.totaux.repas)}</td>
                    <td style={{ ...td, textAlign: "right", borderTop: "2px solid rgba(0,0,0,.15)" }}>{eur(data.totaux.hotel)}</td>
                    <td style={{ ...td, textAlign: "right", borderTop: "2px solid rgba(0,0,0,.15)" }}>{eur(data.totaux.divers)}</td>
                    <td style={{ ...td, textAlign: "right", borderTop: "2px solid rgba(0,0,0,.15)" }}>{eur(data.totaux.stotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {data.footnotes.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {data.footnotes.map((fn) => (
                  <p key={fn.index} style={{ fontSize: 11, color: "#7F7F7F", margin: "0 0 2px" }}>({fn.index}) {fn.label}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
