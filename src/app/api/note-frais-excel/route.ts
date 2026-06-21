import ExcelJS from "exceljs";
import { getNoteFraisData } from "@/lib/note-frais-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONEY = '#,##0.00\\ "€"';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const client = url.searchParams.get("client") ?? "";
  const debut = url.searchParams.get("debut") ?? "";
  const fin = url.searchParams.get("fin") ?? "";
  if (!debut || !fin) return new Response("Paramètres manquants", { status: 400 });

  const data = await getNoteFraisData(client, debut, fin);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Note de frais");

  const titleRow = ws.addRow([`Note de frais / remboursement dépenses engagées — ${data.periodeLabel}`]);
  titleRow.font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.addRow(["Entreprise", "Ethik & Co"]);
  ws.addRow(["Adresse", data.adresse]);
  ws.addRow(["Client concerné", data.clientLabel]);
  ws.addRow(["Bénéficiaire", data.nomConsultant]);
  ws.addRow(["Titre", data.titreConsultant]);
  ws.addRow(["Période", data.periodeLabel]);
  ws.addRow(["Date de la demande", data.dateDemande]);
  const totalRow = ws.addRow(["TOTAL NOTE DE FRAIS", data.total]);
  totalRow.font = { bold: true };
  totalRow.getCell(2).numFmt = MONEY;
  ws.addRow([]);

  const cols = ["Date", "Client", "Nature", "Nb km", "Renvoi", "Comp. km", "Transport", "Parking/Péage", "Repas", "Hôtel", "Divers", "Sous-total"];
  const headerRow = ws.addRow(cols);
  headerRow.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00B0F0" } };
    c.alignment = { horizontal: "center" };
  });

  const moneyCols = [6, 7, 8, 9, 10, 11, 12];
  for (const l of data.lignes) {
    const r = ws.addRow([l.date, l.client, l.nature, l.km ?? 0, l.marker ?? "", l.compensation, l.transport, l.parking, l.repas, l.hotel, l.divers, l.stotal]);
    moneyCols.forEach((i) => (r.getCell(i).numFmt = MONEY));
  }

  const t = data.totaux;
  const totRow = ws.addRow(["TOTAUX", "", "", t.km, "", t.compensation, t.transport, t.parking, t.repas, t.hotel, t.divers, t.stotal]);
  totRow.font = { bold: true };
  moneyCols.forEach((i) => (totRow.getCell(i).numFmt = MONEY));

  if (data.footnotes.length) {
    ws.addRow([]);
    for (const f of data.footnotes) ws.addRow([`(${f.index}) ${f.label}`]);
  }

  ws.addRow([]);
  ws.addRow(["Coordonnées bancaires"]).font = { bold: true };
  if (data.titulaireCompte) ws.addRow(["Titulaire", data.titulaireCompte]);
  ws.addRow(["IBAN", data.iban]);
  ws.addRow(["BIC", data.bic]);
  ws.addRow([]);
  ws.addRow(["Certifié exact le", data.dateDemande]);
  ws.addRow([data.nomConsultant]).font = { italic: true, bold: true };

  // largeurs
  const widths = [12, 18, 30, 8, 8, 12, 12, 14, 10, 10, 10, 12];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="note-de-frais_${data.fichierSlug}.xlsx"`,
    },
  });
}
