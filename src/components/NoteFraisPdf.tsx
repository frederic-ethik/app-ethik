import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NoteFraisData } from "@/lib/note-frais-data";

const eur = (n: number) => (n ? n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "—");
const km = (n: number | null) => (n ? String(Math.round(n)) : "");

const BLEU = "#00B0F0";
const GRIS = "#595959";

const W = { date: "11%", nature: "24%", km: "8%", comp: "11%", tr: "9%", pk: "9%", re: "7%", ho: "6%", di: "7%", st: "8%" };

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8, color: GRIS, fontFamily: "Helvetica" },
  hRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  logo: { height: 58 },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", color: GRIS, marginBottom: 10 },
  infoGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  infoLabel: { color: "#7F7F7F" },
  infoVal: { fontFamily: "Helvetica-Bold" },
  totalBox: { backgroundColor: "#e0f5fe", padding: 6, borderRadius: 3, marginVertical: 8, flexDirection: "row", justifyContent: "space-between" },
  th: { backgroundColor: BLEU, color: "#fff", padding: 3, fontSize: 7, fontFamily: "Helvetica-Bold" },
  td: { padding: 3, fontSize: 7, borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  tot: { padding: 3, fontSize: 7, fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: "#999", backgroundColor: "#f2f4f5" },
  right: { textAlign: "right" },
  marker: { fontSize: 5, color: "#0077a8" },
  notes: { marginTop: 8 },
  noteLine: { fontSize: 7, color: "#7F7F7F", marginBottom: 1 },
  footer: { marginTop: 14, flexDirection: "row", justifyContent: "space-between" },
});

function info(label: string, val: string) {
  return (
    <View style={s.infoGrid} key={label}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoVal}>{val}</Text>
    </View>
  );
}

function NoteFraisDoc({ data, logo }: { data: NoteFraisData; logo: Buffer | null }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.hRow}>
          {logo ? <Image src={logo} style={s.logo} /> : <Text> </Text>}
          <Text style={{ fontSize: 8 }}>Date de la demande : {data.dateDemande}</Text>
        </View>

        <Text style={s.title}>Note de frais / remboursement dépenses engagées — {data.periodeLabel}</Text>

        <View style={{ flexDirection: "row", gap: 20, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            {info("Entreprise", "Ethik & Co")}
            {info("Adresse", data.adresse || "—")}
            {info("Client concerné", data.clientLabel)}
          </View>
          <View style={{ flex: 1 }}>
            {info("Bénéficiaire", data.nomConsultant)}
            {info("Titre", data.titreConsultant)}
            {info("Période", data.periodeLabel)}
          </View>
        </View>

        <View style={s.totalBox}>
          <Text style={{ fontFamily: "Helvetica-Bold", color: "#0077a8" }}>TOTAL NOTE DE FRAIS</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", color: "#0077a8" }}>{eur(data.total)}</Text>
        </View>

        {/* Tableau */}
        <View style={{ flexDirection: "row" }}>
          <Text style={[s.th, { width: W.date }]}>Date</Text>
          <Text style={[s.th, { width: W.nature }]}>Nature</Text>
          <Text style={[s.th, { width: W.km, textAlign: "right" }]}>Nb km</Text>
          <Text style={[s.th, { width: W.comp, textAlign: "right" }]}>Comp. km</Text>
          <Text style={[s.th, { width: W.tr, textAlign: "right" }]}>Transp.</Text>
          <Text style={[s.th, { width: W.pk, textAlign: "right" }]}>Park/Péage</Text>
          <Text style={[s.th, { width: W.re, textAlign: "right" }]}>Repas</Text>
          <Text style={[s.th, { width: W.ho, textAlign: "right" }]}>Hôtel</Text>
          <Text style={[s.th, { width: W.di, textAlign: "right" }]}>Divers</Text>
          <Text style={[s.th, { width: W.st, textAlign: "right" }]}>S-total</Text>
        </View>

        {data.lignes.map((l, i) => (
          <View style={{ flexDirection: "row" }} key={i} wrap={false}>
            <Text style={[s.td, { width: W.date }]}>{l.date}</Text>
            <Text style={[s.td, { width: W.nature }]}>{data.multiClient ? `[${l.client}] ` : ""}{l.nature}</Text>
            <Text style={[s.td, { width: W.km }, s.right]}>
              {km(l.km)}
              {l.marker ? <Text style={s.marker}> ({l.marker})</Text> : null}
            </Text>
            <Text style={[s.td, { width: W.comp }, s.right]}>{eur(l.compensation)}</Text>
            <Text style={[s.td, { width: W.tr }, s.right]}>{eur(l.transport)}</Text>
            <Text style={[s.td, { width: W.pk }, s.right]}>{eur(l.parking)}</Text>
            <Text style={[s.td, { width: W.re }, s.right]}>{eur(l.repas)}</Text>
            <Text style={[s.td, { width: W.ho }, s.right]}>{eur(l.hotel)}</Text>
            <Text style={[s.td, { width: W.di }, s.right]}>{eur(l.divers)}</Text>
            <Text style={[s.td, { width: W.st }, s.right]}>{eur(l.stotal)}</Text>
          </View>
        ))}

        <View style={{ flexDirection: "row" }}>
          <Text style={[s.tot, { width: W.date }]}>TOTAUX</Text>
          <Text style={[s.tot, { width: W.nature }]}></Text>
          <Text style={[s.tot, { width: W.km }, s.right]}>{km(data.totaux.km)}</Text>
          <Text style={[s.tot, { width: W.comp }, s.right]}>{eur(data.totaux.compensation)}</Text>
          <Text style={[s.tot, { width: W.tr }, s.right]}>{eur(data.totaux.transport)}</Text>
          <Text style={[s.tot, { width: W.pk }, s.right]}>{eur(data.totaux.parking)}</Text>
          <Text style={[s.tot, { width: W.re }, s.right]}>{eur(data.totaux.repas)}</Text>
          <Text style={[s.tot, { width: W.ho }, s.right]}>{eur(data.totaux.hotel)}</Text>
          <Text style={[s.tot, { width: W.di }, s.right]}>{eur(data.totaux.divers)}</Text>
          <Text style={[s.tot, { width: W.st }, s.right]}>{eur(data.totaux.stotal)}</Text>
        </View>

        {data.footnotes.length > 0 && (
          <View style={s.notes}>
            {data.footnotes.map((f) => (
              <Text style={s.noteLine} key={f.index}>({f.index}) {f.label}</Text>
            ))}
          </View>
        )}

        <View style={s.footer}>
          <View>
            <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>Coordonnées bancaires</Text>
            {data.titulaireCompte ? <Text>Titulaire : {data.titulaireCompte}</Text> : null}
            <Text>IBAN : {data.iban || "—"}</Text>
            <Text>BIC : {data.bic || "—"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text>Certifié exact le {data.dateDemande}</Text>
            <Text style={{ fontFamily: "Helvetica-BoldOblique", marginTop: 6 }}>{data.nomConsultant}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function genererNoteFraisPdf(data: NoteFraisData): Promise<Buffer> {
  let logo: Buffer | null = null;
  try {
    logo = readFileSync(join(process.cwd(), "public", "logo.png"));
  } catch {
    logo = null;
  }
  return renderToBuffer(<NoteFraisDoc data={data} logo={logo} />);
}
