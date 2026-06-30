import { prisma } from "@/lib/prisma";
import { MOIS, formatHM, heureDe } from "@/lib/format";

const pad = (n: number) => String(n).padStart(2, "0");

const TYPE_CLIENT_LABEL: Record<string, string> = {
  ESS_ASSO: "ESS · Association",
  ESS_SCOOP: "ESS · SCOP",
  SECTEUR_MARCHAND: "Secteur marchand",
  NON_FACTURABLE: "Non facturable",
  NON_FACTURE: "Non facturé",
};

export type RapportLigne = { type: string; heures: number; heuresLabel: string };
export type RapportActivite = { date: string; horaire: string; type: string; commentaire: string; dureeLabel: string };
export type MoisHist = {
  key: string;
  label: string; // "juin 2026"
  totalHeuresLabel: string;
  joursFactures: number | null;
  moyenneLabel: string;
};
export type TypeHist = { type: string; heuresLabels: string[]; totalLabel: string };
export type RapportData = {
  mode: "mois" | "periode";
  // Mode période : totaux de la colonne « Total période » (pied de tableau)
  joursPeriode: number | null;
  moyennePeriodeLabel: string;
  clientLabel: string;
  typeClientLabel: string;
  periodeLabel: string;
  dateEdition: string;
  nomConsultant: string;
  titreConsultant: string;
  adresse: string;
  totalHeures: number;
  totalHeuresLabel: string;
  joursFactures: number | null;
  moyenneParJourLabel: string;
  synthese: string;
  repartition: RapportLigne[];
  activites: RapportActivite[];
  // Historique (profondeur : on remonte tant qu'il n'y a pas plus de 2 mois consécutifs sans activité)
  histoMoisLabels: string[];
  histoMoisLabelsCourts: string[];
  histoMoisIsFocus: boolean[];
  historiqueMois: MoisHist[];
  historiqueTypes: TypeHist[];
  histoTotauxHeures: string[];
  histoJoursFactures: (number | null)[];
  histoMoyennes: string[];
  histoGrandTotalLabel: string;
  fichierSlug: string;
};

export async function getRapportData(clientId: string, annee: number, mois: number): Promise<RapportData> {
  const [client, settings, acts, rapports] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.activity.findMany({
      where: { clientId },
      include: { missionType: true },
      orderBy: [{ dateAct: "asc" }, { debutAct: "asc" }],
    }),
    prisma.rapportMensuel.findMany({ where: { clientId } }),
  ]);

  const focusIdx = annee * 12 + (mois - 1);

  // Agrégations sur tout l'historique
  const moisTotal = new Map<number, number>(); // idx mois -> heures
  const parType = new Map<string, { type: string; perMois: Map<number, number> }>();
  let firstIdx = focusIdx;
  for (const a of acts) {
    const idx = a.dateAct.getUTCFullYear() * 12 + a.dateAct.getUTCMonth();
    moisTotal.set(idx, (moisTotal.get(idx) ?? 0) + a.dureeH);
    if (idx < firstIdx) firstIdx = idx;
    const type = a.missionType ? `${a.missionType.categorie} › ${a.missionType.objet}` : "(sans type)";
    let t = parType.get(type);
    if (!t) {
      t = { type, perMois: new Map() };
      parType.set(type, t);
    }
    t.perMois.set(idx, (t.perMois.get(idx) ?? 0) + a.dureeH);
  }

  const factForIdx = (idx: number) =>
    rapports.find((r) => r.annee === Math.floor(idx / 12) && r.mois === (idx % 12) + 1)?.joursValides ?? null;

  // Fenêtre d'historique : on remonte depuis le mois sélectionné, on s'arrête dès
  // qu'on rencontre PLUS de 2 mois consécutifs sans activité.
  let startIdx = focusIdx;
  let empties = 0;
  for (let idx = focusIdx; idx >= firstIdx; idx--) {
    if ((moisTotal.get(idx) ?? 0) > 0) {
      startIdx = idx;
      empties = 0;
    } else {
      empties++;
      if (empties > 2) break;
    }
  }

  // Ordre ANTI-CHRONOLOGIQUE (mois du rapport en premier), comme le tableau à l'écran
  const idxs: number[] = [];
  for (let idx = focusIdx; idx >= startIdx; idx--) idxs.push(idx);
  const histoMoisIsFocus = idxs.map((idx) => idx === focusIdx);

  const histoMoisLabels = idxs.map((idx) => `${MOIS[idx % 12]} ${Math.floor(idx / 12)}`);
  const histoMoisLabelsCourts = idxs.map((idx) => `${pad((idx % 12) + 1)}/${String(Math.floor(idx / 12)).slice(2)}`);
  const historiqueMois: MoisHist[] = idxs.map((idx) => {
    const total = moisTotal.get(idx) ?? 0;
    const jf = factForIdx(idx);
    return {
      key: `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`,
      label: `${MOIS[idx % 12]} ${Math.floor(idx / 12)}`,
      totalHeuresLabel: formatHM(total),
      joursFactures: jf,
      moyenneLabel: jf ? formatHM(total / jf) : "—",
    };
  });
  const histoTotauxHeures = idxs.map((idx) => formatHM(moisTotal.get(idx) ?? 0));
  const histoJoursFactures = idxs.map((idx) => factForIdx(idx));
  const histoMoyennes = idxs.map((idx) => {
    const jf = factForIdx(idx);
    return jf ? formatHM((moisTotal.get(idx) ?? 0) / jf) : "—";
  });

  const historiqueTypes: TypeHist[] = [...parType.values()]
    .filter((t) => idxs.some((idx) => (t.perMois.get(idx) ?? 0) > 0))
    .sort((a, b) => a.type.localeCompare(b.type))
    .map((t) => {
      const heures = idxs.map((idx) => t.perMois.get(idx) ?? 0);
      return { type: t.type, heuresLabels: heures.map(formatHM), totalLabel: formatHM(heures.reduce((s, h) => s + h, 0)) };
    });

  // Mois sélectionné (focus)
  const focusActs = acts.filter((a) => a.dateAct.getUTCFullYear() * 12 + a.dateAct.getUTCMonth() === focusIdx);
  const totalHeures = moisTotal.get(focusIdx) ?? 0;
  const repartition: RapportLigne[] = [...parType.values()]
    .filter((t) => (t.perMois.get(focusIdx) ?? 0) > 0)
    .map((t) => ({ type: t.type, heures: t.perMois.get(focusIdx) ?? 0, heuresLabel: formatHM(t.perMois.get(focusIdx) ?? 0) }))
    .sort((a, b) => a.type.localeCompare(b.type));

  const activites: RapportActivite[] = focusActs.map((a) => ({
    date: a.dateAct.toLocaleDateString("fr-FR"),
    horaire: `${heureDe(a.debutAct)}${a.finAct ? `–${heureDe(a.finAct)}` : ""}`,
    type: a.missionType ? `${a.missionType.categorie} › ${a.missionType.objet}` : "—",
    commentaire: a.commentaire ?? "",
    dureeLabel: formatHM(a.dureeH),
  }));

  const joursFactures = factForIdx(focusIdx);
  const clientLabel = client?.raisonSociale ?? "Client";

  return {
    mode: "mois",
    joursPeriode: null,
    moyennePeriodeLabel: "—",
    clientLabel,
    typeClientLabel: client ? TYPE_CLIENT_LABEL[client.typeClient] ?? client.typeClient : "",
    periodeLabel: `${MOIS[mois - 1]} ${annee}`,
    dateEdition: new Date().toLocaleDateString("fr-FR"),
    nomConsultant: settings?.nomConsultant ?? "Frédéric WOEHREL",
    titreConsultant: settings?.titreConsultant ?? "Consultant",
    adresse: settings?.adresseDomicile ?? "",
    totalHeures,
    totalHeuresLabel: formatHM(totalHeures),
    joursFactures,
    moyenneParJourLabel: joursFactures ? formatHM(totalHeures / joursFactures) : "—",
    synthese: rapports.find((r) => r.annee === annee && r.mois === mois)?.syntheseValidee ?? "",
    repartition,
    activites,
    histoMoisLabels,
    histoMoisLabelsCourts,
    histoMoisIsFocus,
    historiqueMois,
    historiqueTypes,
    histoTotauxHeures,
    histoJoursFactures,
    histoMoyennes,
    histoGrandTotalLabel: formatHM(idxs.reduce((s, idx) => s + (moisTotal.get(idx) ?? 0), 0)),
    fichierSlug: clientLabel.replace(/[^a-z0-9]+/gi, "_") + `_${annee}-${pad(mois)}`,
  };
}

const frDate = (d: Date) => `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;

// Données du rapport sur une période personnalisée (date à date). Les mois de la
// période sont en ordre CHRONOLOGIQUE, suivis d'une colonne « Total période ».
// La synthèse est passée telle quelle (générée à la volée, non stockée).
export async function getRapportPeriodeData(
  clientId: string,
  debutISO: string,
  finISO: string,
  synthese = "",
): Promise<RapportData> {
  const [client, settings, allActs, rapports] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.activity.findMany({
      where: { clientId },
      include: { missionType: true },
      orderBy: [{ dateAct: "asc" }, { debutAct: "asc" }],
    }),
    prisma.rapportMensuel.findMany({ where: { clientId } }),
  ]);

  const debut = new Date(`${debutISO}T00:00:00.000Z`);
  const fin = new Date(`${finISO}T00:00:00.000Z`);
  const acts = allActs.filter((a) => a.dateAct >= debut && a.dateAct <= fin);

  // Mois de la période, en ordre chronologique
  const debutIdx = debut.getUTCFullYear() * 12 + debut.getUTCMonth();
  const finIdx = fin.getUTCFullYear() * 12 + fin.getUTCMonth();
  const idxs: number[] = [];
  for (let idx = debutIdx; idx <= finIdx; idx++) idxs.push(idx);

  // Agrégations sur la période
  const moisTotal = new Map<number, number>();
  const parType = new Map<string, { type: string; perMois: Map<number, number> }>();
  for (const a of acts) {
    const idx = a.dateAct.getUTCFullYear() * 12 + a.dateAct.getUTCMonth();
    moisTotal.set(idx, (moisTotal.get(idx) ?? 0) + a.dureeH);
    const type = a.missionType ? `${a.missionType.categorie} › ${a.missionType.objet}` : "(sans type)";
    let t = parType.get(type);
    if (!t) {
      t = { type, perMois: new Map() };
      parType.set(type, t);
    }
    t.perMois.set(idx, (t.perMois.get(idx) ?? 0) + a.dureeH);
  }

  const factForIdx = (idx: number) =>
    rapports.find((r) => r.annee === Math.floor(idx / 12) && r.mois === (idx % 12) + 1)?.joursValides ?? null;

  const histoMoisIsFocus = idxs.map(() => false);
  const histoMoisLabels = idxs.map((idx) => `${MOIS[idx % 12]} ${Math.floor(idx / 12)}`);
  const histoMoisLabelsCourts = idxs.map((idx) => `${pad((idx % 12) + 1)}/${String(Math.floor(idx / 12)).slice(2)}`);
  const historiqueMois: MoisHist[] = idxs.map((idx) => {
    const total = moisTotal.get(idx) ?? 0;
    const jf = factForIdx(idx);
    return {
      key: `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`,
      label: `${MOIS[idx % 12]} ${Math.floor(idx / 12)}`,
      totalHeuresLabel: formatHM(total),
      joursFactures: jf,
      moyenneLabel: jf ? formatHM(total / jf) : "—",
    };
  });
  const histoTotauxHeures = idxs.map((idx) => formatHM(moisTotal.get(idx) ?? 0));
  const histoJoursFactures = idxs.map((idx) => factForIdx(idx));
  const histoMoyennes = idxs.map((idx) => {
    const jf = factForIdx(idx);
    return jf ? formatHM((moisTotal.get(idx) ?? 0) / jf) : "—";
  });

  const historiqueTypes: TypeHist[] = [...parType.values()]
    .filter((t) => idxs.some((idx) => (t.perMois.get(idx) ?? 0) > 0))
    .sort((a, b) => a.type.localeCompare(b.type))
    .map((t) => {
      const heures = idxs.map((idx) => t.perMois.get(idx) ?? 0);
      return { type: t.type, heuresLabels: heures.map(formatHM), totalLabel: formatHM(heures.reduce((s, h) => s + h, 0)) };
    });

  // Totaux de la période
  const totalHeures = idxs.reduce((s, idx) => s + (moisTotal.get(idx) ?? 0), 0);
  const joursValeurs = idxs.map(factForIdx).filter((j): j is number => j != null);
  const joursPeriode = joursValeurs.length ? joursValeurs.reduce((s, j) => s + j, 0) : null;
  const moyennePeriodeLabel = joursPeriode ? formatHM(totalHeures / joursPeriode) : "—";

  const repartition: RapportLigne[] = [...parType.values()]
    .map((t) => ({ type: t.type, heures: idxs.reduce((s, idx) => s + (t.perMois.get(idx) ?? 0), 0) }))
    .filter((r) => r.heures > 0)
    .map((r) => ({ type: r.type, heures: r.heures, heuresLabel: formatHM(r.heures) }))
    .sort((a, b) => a.type.localeCompare(b.type));

  const activites: RapportActivite[] = acts.map((a) => ({
    date: a.dateAct.toLocaleDateString("fr-FR"),
    horaire: `${heureDe(a.debutAct)}${a.finAct ? `–${heureDe(a.finAct)}` : ""}`,
    type: a.missionType ? `${a.missionType.categorie} › ${a.missionType.objet}` : "—",
    commentaire: a.commentaire ?? "",
    dureeLabel: formatHM(a.dureeH),
  }));

  const clientLabel = client?.raisonSociale ?? "Client";

  return {
    mode: "periode",
    joursPeriode,
    moyennePeriodeLabel,
    clientLabel,
    typeClientLabel: client ? TYPE_CLIENT_LABEL[client.typeClient] ?? client.typeClient : "",
    periodeLabel: `Du ${frDate(debut)} au ${frDate(fin)}`,
    dateEdition: new Date().toLocaleDateString("fr-FR"),
    nomConsultant: settings?.nomConsultant ?? "Frédéric WOEHREL",
    titreConsultant: settings?.titreConsultant ?? "Consultant",
    adresse: settings?.adresseDomicile ?? "",
    totalHeures,
    totalHeuresLabel: formatHM(totalHeures),
    joursFactures: joursPeriode,
    moyenneParJourLabel: moyennePeriodeLabel,
    synthese,
    repartition,
    activites,
    histoMoisLabels,
    histoMoisLabelsCourts,
    histoMoisIsFocus,
    historiqueMois,
    historiqueTypes,
    histoTotauxHeures,
    histoJoursFactures,
    histoMoyennes,
    histoGrandTotalLabel: formatHM(totalHeures),
    fichierSlug: clientLabel.replace(/[^a-z0-9]+/gi, "_") + `_${debutISO}_${finISO}`,
  };
}
