import ExcelJS from "exceljs";
import { getRapportData, getRapportPeriodeData, type RapportData } from "@/lib/rapport-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLEU = "FF00B0F0";

async function buildWorkbook(data: RapportData): Promise<Buffer> {
  const periode = data.mode === "periode";
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

  // Répartition par type de mission — mois en colonnes + colonne « Total » / « Total période »
  ws.addRow(["Répartition par type de mission"]).font = { bold: true };
  const totalHeader = periode ? "Total période" : "Total";
  const head = ws.addRow(["Catégorie › Objet", ...data.histoMoisLabels, totalHeader]);
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLEU } };
    c.alignment = { horizontal: "center" };
  });
  const bodyRows = data.historiqueTypes.map((t) => ws.addRow([t.type, ...t.heuresLabels, t.totalLabel]));

  const rowTot = ws.addRow(["Total heures", ...data.histoTotauxHeures, data.histoGrandTotalLabel]);
  rowTot.font = { bold: true };
  const factCells = data.histoJoursFactures.map((j) => (j != null ? j : "—"));
  const rowFact = ws.addRow(["Jours facturés", ...factCells, periode ? (data.joursPeriode ?? "—") : ""]);
  rowFact.font = { bold: true, color: { argb: "FF1D6F42" } };
  const rowMoy = ws.addRow(["Moyenne / jour facturé", ...data.histoMoyennes, periode ? data.moyennePeriodeLabel : ""]);
  rowMoy.font = { color: { argb: "FF7F7F7F" } };

  // Surlignage de la colonne du mois concerné (mode mensuel uniquement)
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
  ws.getColumn(data.histoMoisLabels.length + 2).width = 13;

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
  return Buffer.from(buf);
}

function excelResponse(buf: Buffer, slug: string) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rapport_${slug}.xlsx"`,
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const client = url.searchParams.get("client") ?? "";
  if (!client) return new Response("Paramètres manquants", { status: 400 });

  const debut = url.searchParams.get("debut");
  const fin = url.searchParams.get("fin");
  if (debut && fin) {
    // Mode période (date à date) — sans synthèse (lien direct, lecture seule).
    const data = await getRapportPeriodeData(client, debut, fin);
    return excelResponse(await buildWorkbook(data), data.fichierSlug);
  }

  const annee = Number(url.searchParams.get("annee"));
  const mois = Number(url.searchParams.get("mois"));
  if (!annee || !mois) return new Response("Paramètres manquants", { status: 400 });
  const data = await getRapportData(client, annee, mois);
  return excelResponse(await buildWorkbook(data), data.fichierSlug);
}

// Mode période (date à date) : la synthèse éditée à l'écran est transmise dans le corps.
export async function POST(req: Request) {
  const form = await req.formData();
  const client = String(form.get("client") ?? "");
  const debut = String(form.get("debut") ?? "");
  const fin = String(form.get("fin") ?? "");
  const synthese = String(form.get("synthese") ?? "");
  if (!client || !debut || !fin) return new Response("Paramètres manquants", { status: 400 });

  const data = await getRapportPeriodeData(client, debut, fin, synthese);
  return excelResponse(await buildWorkbook(data), data.fichierSlug);
}
