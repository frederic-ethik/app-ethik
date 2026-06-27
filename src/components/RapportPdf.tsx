import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RapportData } from "@/lib/rapport-data";

const BLEU = "#00B0F0";
const GRIS = "#595959";

const W = { date: "13%", hor: "14%", type: "31%", com: "30%", dur: "12%" };

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: GRIS, fontFamily: "Helvetica", lineHeight: 1.4 },
  hRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  logo: { height: 50 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", color: GRIS, marginBottom: 2 },
  sub: { fontSize: 10, color: "#7F7F7F", marginBottom: 12 },
  infoRow: { flexDirection: "row", gap: 20, marginBottom: 12 },
  infoCol: { flex: 1 },
  infoLabel: { color: "#7F7F7F", fontSize: 8 },
  infoVal: { fontFamily: "Helvetica-Bold" },
  recap: { flexDirection: "row", backgroundColor: "#e0f5fe", borderRadius: 4, padding: 8, marginBottom: 14, gap: 18 },
  recapItem: { flex: 1 },
  recapLabel: { fontSize: 8, color: "#0077a8" },
  recapVal: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0077a8" },
  secTitle: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "#a5a5a5", marginBottom: 6, marginTop: 4 },
  syntheseLine: { marginBottom: 2 },
  th: { backgroundColor: BLEU, color: "#fff", padding: 4, fontSize: 8, fontFamily: "Helvetica-Bold" },
  td: { padding: 4, fontSize: 8, borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  tot: { padding: 4, fontSize: 8, fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: "#999", backgroundColor: "#f2f4f5" },
  right: { textAlign: "right" },
  footer: { position: "absolute", bottom: 22, left: 32, right: 32, fontSize: 7, color: "#a5a5a5", textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#ddd", paddingTop: 4 },
});

function RapportDoc({ data, logo }: { data: RapportData; logo: Buffer | null }) {
  const syntheseLignes = data.synthese ? data.synthese.split("\n") : [];
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.hRow}>
          {logo ? <Image src={logo} style={s.logo} /> : <Text> </Text>}
          <Text style={{ fontSize: 8, color: "#7F7F7F" }}>Édité le {data.dateEdition}</Text>
        </View>

        <Text style={s.title}>Rapport d&apos;activité — {data.periodeLabel}</Text>
        <Text style={s.sub}>{data.clientLabel}</Text>

        <View style={s.infoRow}>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Prestataire</Text>
            <Text style={s.infoVal}>Ethik &amp; Co — {data.nomConsultant}</Text>
            <Text>{data.titreConsultant}</Text>
            {data.adresse ? <Text>{data.adresse}</Text> : null}
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Client</Text>
            <Text style={s.infoVal}>{data.clientLabel}</Text>
            {data.typeClientLabel ? <Text>{data.typeClientLabel}</Text> : null}
            <Text>Période : {data.periodeLabel}</Text>
          </View>
        </View>

        <View style={s.recap}>
          <View style={s.recapItem}>
            <Text style={s.recapLabel}>Total d&apos;heures</Text>
            <Text style={s.recapVal}>{data.totalHeuresLabel}</Text>
          </View>
          <View style={s.recapItem}>
            <Text style={s.recapLabel}>Jours facturés</Text>
            <Text style={s.recapVal}>{data.joursFactures != null ? data.joursFactures.toLocaleString("fr-FR") : "—"}</Text>
          </View>
          <View style={s.recapItem}>
            <Text style={s.recapLabel}>Moyenne / jour facturé</Text>
            <Text style={s.recapVal}>{data.moyenneParJourLabel}</Text>
          </View>
        </View>

        {/* Synthèse */}
        {syntheseLignes.length > 0 && (
          <View>
            <Text style={s.secTitle}>Synthèse de l&apos;activité</Text>
            <View style={{ marginBottom: 12 }}>
              {syntheseLignes.map((l, i) => (
                <Text key={i} style={s.syntheseLine}>{l || " "}</Text>
              ))}
            </View>
          </View>
        )}

        {/* Répartition par type de mission — mois en colonnes (max 6 mois récents) */}
        {data.historiqueTypes.length > 0 && (() => {
          const N = Math.min(6, data.histoMoisLabelsCourts.length);
          const tronque = data.histoMoisLabelsCourts.length > N;
          const mois = data.histoMoisLabelsCourts.slice(0, N); // anti-chrono : mois du rapport en premier
          const focus = data.histoMoisIsFocus.slice(0, N);
          const typeW = "34%";
          const moisW = `${(66 / N).toFixed(3)}%`;
          const hl = (i: number) => (focus[i] ? { backgroundColor: "#eef9ff" } : {});
          const hlHead = (i: number) => (focus[i] ? { backgroundColor: "#0077a8" } : {});
          return (
            <View wrap={false}>
              <Text style={s.secTitle}>Répartition par type de mission{tronque ? " — 6 derniers mois" : ""}</Text>
              <View style={{ flexDirection: "row" }}>
                <Text style={[s.th, { width: typeW }]}>Catégorie › Objet</Text>
                {mois.map((m, i) => (
                  <Text key={i} style={[s.th, { width: moisW, textAlign: "right" }, hlHead(i)]}>{m}</Text>
                ))}
              </View>
              {data.historiqueTypes.map((t, i) => (
                <View style={{ flexDirection: "row" }} key={i} wrap={false}>
                  <Text style={[s.td, { width: typeW }]}>{t.type}</Text>
                  {t.heuresLabels.slice(0, N).map((h, j) => (
                    <Text key={j} style={[s.td, { width: moisW }, s.right, hl(j)]}>{h}</Text>
                  ))}
                </View>
              ))}
              <View style={{ flexDirection: "row" }}>
                <Text style={[s.tot, { width: typeW }]}>Total heures</Text>
                {data.histoTotauxHeures.slice(0, N).map((h, j) => (
                  <Text key={j} style={[s.tot, { width: moisW }, s.right, hl(j)]}>{h}</Text>
                ))}
              </View>
              <View style={{ flexDirection: "row" }}>
                <Text style={[s.tot, { width: typeW }]}>Jours facturés</Text>
                {data.histoJoursFactures.slice(0, N).map((j, k) => (
                  <Text key={k} style={[s.tot, { width: moisW }, s.right, hl(k)]}>{j != null ? j.toLocaleString("fr-FR") : "—"}</Text>
                ))}
              </View>
              <View style={{ flexDirection: "row" }}>
                <Text style={[s.tot, { width: typeW }]}>Moy. / jour facturé</Text>
                {data.histoMoyennes.slice(0, N).map((m, k) => (
                  <Text key={k} style={[s.tot, { width: moisW }, s.right, hl(k)]}>{m}</Text>
                ))}
              </View>
              <View style={{ height: 10 }} />
            </View>
          );
        })()}

        {/* Détail des activités */}
        <Text style={[s.secTitle, { marginTop: 14 }]}>Détail des activités</Text>
        {data.activites.length === 0 ? (
          <Text style={{ color: "#a5a5a5" }}>Aucune activité ce mois-ci.</Text>
        ) : (
          <>
            <View style={{ flexDirection: "row" }}>
              <Text style={[s.th, { width: W.date }]}>Date</Text>
              <Text style={[s.th, { width: W.hor }]}>Horaire</Text>
              <Text style={[s.th, { width: W.type }]}>Catégorie › Objet</Text>
              <Text style={[s.th, { width: W.com }]}>Commentaire</Text>
              <Text style={[s.th, { width: W.dur, textAlign: "right" }]}>Durée</Text>
            </View>
            {data.activites.map((a, i) => (
              <View style={{ flexDirection: "row" }} key={i} wrap={false}>
                <Text style={[s.td, { width: W.date }]}>{a.date}</Text>
                <Text style={[s.td, { width: W.hor }]}>{a.horaire}</Text>
                <Text style={[s.td, { width: W.type }]}>{a.type}</Text>
                <Text style={[s.td, { width: W.com }]}>{a.commentaire}</Text>
                <Text style={[s.td, { width: W.dur }, s.right]}>{a.dureeLabel}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row" }}>
              <Text style={[s.tot, { width: W.date }]}>Total</Text>
              <Text style={[s.tot, { width: W.hor }]}></Text>
              <Text style={[s.tot, { width: W.type }]}></Text>
              <Text style={[s.tot, { width: W.com }]}></Text>
              <Text style={[s.tot, { width: W.dur }, s.right]}>{data.totalHeuresLabel}</Text>
            </View>
          </>
        )}

        <Text style={s.footer} fixed>
          Ethik &amp; Co — {data.nomConsultant}{data.adresse ? ` — ${data.adresse}` : ""}
        </Text>
      </Page>
    </Document>
  );
}

export async function genererRapportPdf(data: RapportData): Promise<Buffer> {
  let logo: Buffer | null = null;
  try {
    logo = readFileSync(join(process.cwd(), "public", "logo.png"));
  } catch {
    logo = null;
  }
  return renderToBuffer(<RapportDoc data={data} logo={logo} />);
}
