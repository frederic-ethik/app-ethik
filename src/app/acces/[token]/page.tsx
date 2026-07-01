import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { MOIS } from "@/lib/format";
import { getRapportData } from "@/lib/rapport-data";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const moisKey = (idx: number) => `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;

// Robots, moteurs et aperçus de lien (email/messagerie) à ne pas comptabiliser comme consultation.
const ROBOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|slackbot|telegram|discord|twitter|linkedin|embedly|preview|monitor|pingdom|uptime|curl|wget|python-requests|headless|prerender|lighthouse/i;

function Invalide() {
  return (
    <div style={{ maxWidth: 480, margin: "40px auto", textAlign: "center", background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "32px 28px" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Ethik & Co" style={{ height: 48, marginBottom: 16 }} />
      <h1 style={{ fontSize: 18, color: "#595959" }}>Lien indisponible</h1>
      <p style={{ fontSize: 14, color: "#7F7F7F" }}>
        Ce lien de consultation n&apos;est plus valide ou a été désactivé. Merci de contacter Ethik &amp; Co pour obtenir un lien à jour.
      </p>
    </div>
  );
}

export default async function AccesClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mois?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const client = await prisma.client.findFirst({
    where: { tokenAcces: token, accesActif: true },
    select: { id: true, raisonSociale: true, accesSynthese: true, accesTableau: true, accesDetail: true, accesJours: true },
  });
  if (!client) return <Invalide />;

  // Journal des consultations — jamais bloquant pour le client, et hors robots/aperçus.
  const ua = (await headers()).get("user-agent") ?? "";
  const estRobot = ROBOT_RE.test(ua);
  const clientId = client.id;
  const tracer = async (moisVu: string | null) => {
    if (estRobot) return;
    try {
      await prisma.accesVue.create({ data: { clientId, moisVu, userAgent: ua.slice(0, 300) } });
    } catch {
      /* le suivi ne doit jamais casser la page cliente */
    }
  };

  const bornes = await prisma.activity.aggregate({ where: { clientId: client.id }, _min: { dateAct: true }, _max: { dateAct: true } });
  if (!bornes._max.dateAct) {
    await tracer(null);
    return (
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <Entete client={client.raisonSociale} periode="" />
        <p style={{ fontSize: 14, color: "#7F7F7F" }}>Aucune activité enregistrée pour le moment.</p>
      </div>
    );
  }

  const firstIdx = bornes._min.dateAct!.getUTCFullYear() * 12 + bornes._min.dateAct!.getUTCMonth();
  const lastIdx = bornes._max.dateAct.getUTCFullYear() * 12 + bornes._max.dateAct.getUTCMonth();
  const [py, pm] = (sp.mois ?? "").split("-").map(Number);
  let viewIdx = py && pm ? py * 12 + (pm - 1) : lastIdx;
  viewIdx = Math.min(Math.max(viewIdx, firstIdx), lastIdx);
  const annee = Math.floor(viewIdx / 12);
  const mois = viewIdx % 12;

  await tracer(`${annee}-${pad(mois + 1)}`);

  const data = await getRapportData(client.id, annee, mois + 1);

  const prev = viewIdx > firstIdx ? moisKey(viewIdx - 1) : null;
  const next = viewIdx < lastIdx ? moisKey(viewIdx + 1) : null;

  const card = { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "20px 22px", marginBottom: 18 } as const;
  const secTitle = { fontSize: 11, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#a5a5a5", margin: "0 0 12px" };
  const navA = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, textDecoration: "none", color: "#7F7F7F", fontSize: 18, border: "1px solid rgba(0,0,0,.12)", background: "#fff" } as const;
  const navDisabled = { ...navA, color: "#d0d0d0", cursor: "default" };
  const th = { background: "#00B0F0", color: "#fff", padding: "6px 8px", fontSize: 12, fontWeight: 600, textAlign: "right" as const, whiteSpace: "nowrap" as const };
  const thL = { ...th, textAlign: "left" as const };
  const cell = { padding: "5px 8px", fontSize: 12, textAlign: "right" as const, borderBottom: "1px solid rgba(0,0,0,.06)", whiteSpace: "nowrap" as const };
  const cellL = { ...cell, textAlign: "left" as const };
  // Cellules du détail : largeurs fixes + retour à la ligne pour les longs libellés
  const tdWrap = { padding: "5px 8px", fontSize: 12, textAlign: "left" as const, borderBottom: "1px solid rgba(0,0,0,.06)", verticalAlign: "top" as const, overflowWrap: "anywhere" as const };
  const tdDate = { ...tdWrap, whiteSpace: "nowrap" as const };
  const tdDur = { ...tdWrap, textAlign: "right" as const, whiteSpace: "nowrap" as const };
  const focusBg = (i: number) => (data.histoMoisIsFocus[i] ? { background: "#eef9ff" } : null);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Entete client={client.raisonSociale} periode={data.periodeLabel} />

      {/* Navigation entre les mois */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "0 0 18px" }}>
        {prev ? <a href={`/acces/${token}?mois=${prev}`} aria-label="Mois précédent" style={navA}>‹</a> : <span style={navDisabled}>‹</span>}
        <span style={{ fontSize: 14, fontWeight: 600, color: "#595959", minWidth: 130, textAlign: "center" }}>{data.periodeLabel}</span>
        {next ? <a href={`/acces/${token}?mois=${next}`} aria-label="Mois suivant" style={navA}>›</a> : <span style={navDisabled}>›</span>}
      </div>

      {/* Récapitulatif */}
      <div style={{ ...card, display: "flex", gap: 28, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#7F7F7F" }}>Total d&apos;heures</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#0077a8" }}>{data.totalHeuresLabel}</div>
        </div>
        {client.accesJours && (
          <>
            <div>
              <div style={{ fontSize: 12, color: "#7F7F7F" }}>Jours facturés</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: "#595959" }}>{data.joursFactures != null ? data.joursFactures.toLocaleString("fr-FR") : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#7F7F7F" }}>Moyenne / jour</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: "#595959" }}>{data.moyenneParJourLabel}</div>
            </div>
          </>
        )}
      </div>

      {/* Synthèse */}
      {client.accesSynthese && data.synthese && (
        <div style={card}>
          <p style={secTitle}>Synthèse de l&apos;activité</p>
          <div style={{ fontSize: 14, color: "#595959", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{data.synthese}</div>
        </div>
      )}

      {/* Tableau de synthèse (par mois) */}
      {client.accesTableau && data.historiqueTypes.length > 0 && (
        <div style={card}>
          <p style={secTitle}>Tableau de synthèse</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={thL}>Catégorie › Objet</th>
                  {data.histoMoisLabels.map((m, i) => (
                    <th key={i} style={{ ...th, ...(data.histoMoisIsFocus[i] ? { background: "#0077a8" } : null) }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.historiqueTypes.map((t, i) => (
                  <tr key={i}>
                    <td style={cellL}>{t.type}</td>
                    {t.heuresLabels.map((hh, j) => (
                      <td key={j} style={{ ...cell, ...focusBg(j) }}>{hh}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 600 }}>
                  <td style={{ ...cellL, borderTop: "2px solid rgba(0,0,0,.15)" }}>Total heures</td>
                  {data.histoTotauxHeures.map((hh, j) => (
                    <td key={j} style={{ ...cell, borderTop: "2px solid rgba(0,0,0,.15)", ...focusBg(j) }}>{hh}</td>
                  ))}
                </tr>
                {client.accesJours && (
                  <tr style={{ fontWeight: 600, color: "#1d6f42" }}>
                    <td style={cellL}>Jours facturés</td>
                    {data.histoJoursFactures.map((j, k) => (
                      <td key={k} style={{ ...cell, ...focusBg(k) }}>{j != null ? j.toLocaleString("fr-FR") : "—"}</td>
                    ))}
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Détail des activités */}
      {client.accesDetail && (
        <div style={card}>
          <p style={secTitle}>Détail des activités — {data.periodeLabel}</p>
          {data.activites.length === 0 ? (
            <p style={{ fontSize: 14, color: "#a5a5a5" }}>Aucune activité ce mois-ci.</p>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "13%" }} />
                <col style={{ width: "34%" }} />
                <col style={{ width: "41%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={thL}>Date</th>
                  <th style={thL}>Catégorie › Objet</th>
                  <th style={thL}>Commentaire</th>
                  <th style={th}>Durée</th>
                </tr>
              </thead>
              <tbody>
                {data.activites.map((a, i) => (
                  <tr key={i}>
                    <td style={tdDate}>{a.date}</td>
                    <td style={tdWrap}>{a.type}</td>
                    <td style={{ ...tdWrap, color: "#7F7F7F" }}>{a.commentaire}</td>
                    <td style={tdDur}>{a.dureeLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p style={{ fontSize: 12, color: "#a5a5a5", textAlign: "center", margin: "22px 0" }}>
        Document de consultation — Ethik &amp; Co · {data.nomConsultant}
      </p>
    </div>
  );
}

function Entete({ client, periode }: { client: string; periode: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "8px 0 18px" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Ethik & Co" style={{ height: 52 }} />
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 600, color: "#595959", margin: 0 }}>Rapport d&apos;activité{periode ? ` — ${periode}` : ""}</h1>
        <div style={{ fontSize: 14, color: "#7F7F7F" }}>{client}</div>
      </div>
    </div>
  );
}
