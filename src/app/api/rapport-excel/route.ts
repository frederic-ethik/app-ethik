import ExcelJS from "exceljs";
import { getRapportData } from "@/lib/rapport-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLEU = "FF00B0F0";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const client = url.searchParams.get("client") ?? "";
  const annee = Number(url.searchParams.get("annee"));
  const mois = Number(url.searchParams.get("mois"));
  if (!client || !annee || !mois) return new Response("Paramètres manquants", { status: 400 });

  const data = await getRapportData(client, annee, mois);

  const wb = new ExcelJS.Workbook();

  // ===================== Feuille « Rapport » =====================
  const ws = wb.addWorksheet("Rapport");

  const titre = ws.addRow([`Rapport d'activité — ${data.periodeLabel}`]);
  titre.font = { bold: true, size: 14 };
  ws.addRow([data.clientLabel]).font = { size: 12 };
  ws.addRow([]);
  ws.addRow(["Prestataire", `Ethik & Co — ${data.nomConsultant}`]);
  ws.addRow(["", data.titreConsultant]);
  if (data.adresse) ws.addRow(["", data.adresse]);
  ws.addRow(["Client", data.clientLabel]);
  if (data.typeClientLabel) ws.addRow(["Type", data.typeClientLabel]);
  ws.addRow(["Période", data.periodeLabel]);
  ws.addRow(["Édité le", data.dateEdition]);
  ws.addRow([]);

  const recap = ws.addRow(["Total d'heures", data.totalHeuresLabel, "Jours facturés", data.joursFactures ?? "—", "Moyenne / jour", data.moyenneParJourLabel]);
  recap.font = { bold: true };
  ws.addRow([]);

  // Synthèse
  if (data.synthese) {
    ws.addRow(["Synthèse de l'activité"]).font = { bold: true };
    for (const line of data.synthese.split("\n")) ws.addRow([line]);
    ws.addRow([]);
  }

  // Répartition par type de mission — mois en colonnes (toute la profondeur d'historique)
  ws.addRow(["Répartition par type de mission"]).font = { bold: true };
  const head = ws.addRow(["Catégorie › Objet", ...data.histoMoisLabels, "Total"]);
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLEU } };
    c.alignment = { horizontal: "center" };
  });
  const bodyRows = data.historiqueTypes.map((t) => ws.addRow([t.type, ...t.heuresLabels, t.totalLabel]));

  const rowTot = ws.addRow(["Total heures", ...data.histoTotauxHeures, data.histoGrandTotalLabel]);
  rowTot.font = { bold: true };
  const rowFact = ws.addRow(["Jours facturés", ...data.histoJoursFactures.map((j) => (j != null ? j : "—"))]);
  rowFact.font = { bold: true, color: { argb: "FF1D6F42" } };
  const rowMoy = ws.addRow(["Moyenne / jour facturé", ...data.histoMoyennes]);
  rowMoy.font = { color: { argb: "FF7F7F7F" } };

  // Surlignage de la colonne du mois concerné par le rapport
  const pFocus = data.histoMoisIsFocus.findIndex(Boolean);
  if (pFocus >= 0) {
    const focusCol = pFocus + 2; // +1 colonne libellé, +1 base 1
    const hc = head.getCell(focusCol);
    hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0077A8" } };
    for (const r of [...bodyRows, rowTot, rowFact, rowMoy]) {
      r.getCell(focusCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF7FF" } };
    }
  }

  ws.getColumn(1).width = 34;
  for (let i = 0; i < data.histoMoisLabels.length; i++) ws.getColumn(i + 2).width = 11;
  ws.getColumn(data.histoMoisLabels.length + 2).width = 11;

  // ===================== Feuille « Détail » =====================
  const ds = wb.addWorksheet("Détail");
  const dt = ds.addRow([`Détail des activités — ${data.periodeLabel}`]);
  dt.font = { bold: true, size: 13 };
  ds.addRow([data.clientLabel]);
  ds.addRow([]);
  const dHead = ds.addRow(["Date", "Horaire", "Catégorie › Objet", "Commentaire", "Durée"]);
  dHead.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLEU } };
  });
  for (const a of data.activites) ds.addRow([a.date, a.horaire, a.type, a.commentaire, a.dureeLabel]);
  ds.addRow(["Total", "", "", "", data.totalHeuresLabel]).font = { bold: true };
  [14, 14, 34, 50, 12].forEach((w, i) => (ds.getColumn(i + 1).width = w));

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rapport_${data.fichierSlug}.xlsx"`,
    },
  });
}
