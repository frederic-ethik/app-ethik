import { prisma } from "@/lib/prisma";
import { MOIS } from "@/lib/format";
import type { Bareme } from "@/lib/bareme";

export const VEH_LABEL: Record<string, string> = {
  NISSAN_ARIYA_3CV: "Nissan Ariya VE (3 CV)",
  VW_SHARAN_8CV: "VW Sharan Diesel (8 CV)",
};
const PAIE: Record<string, string> = { CARTE: "Carte", ESPECES: "Espèces", CHEQUE: "Chèque", NC: "NC" };

export type LigneNF = {
  date: string;
  client: string;
  nature: string;
  paiement: string;
  km: number | null;
  compensation: number;
  transport: number;
  parking: number;
  repas: number;
  hotel: number;
  divers: number;
  stotal: number;
  marker: number | null;
};
export type Footnote = { index: number; label: string };
export type Totaux = { km: number; compensation: number; transport: number; parking: number; repas: number; hotel: number; divers: number; stotal: number };
export type NoteFraisData = {
  clientLabel: string;
  multiClient: boolean;
  periodeLabel: string;
  dateDemande: string;
  nomConsultant: string;
  titreConsultant: string;
  adresse: string;
  titulaireCompte: string;
  iban: string;
  bic: string;
  total: number;
  lignes: LigneNF[];
  totaux: Totaux;
  footnotes: Footnote[];
  fichierSlug: string;
};

function footnoteLabel(vehicule: string, bareme: Bareme | null): string {
  const nom = VEH_LABEL[vehicule] ?? vehicule;
  if (vehicule === "NISSAN_ARIYA_3CV") {
    const maj = bareme?.majoration ? ` (majoration véhicule électrique +${Math.round(bareme.majoration * 100)} %)` : "";
    return `Véhicule ${nom} — barème kilométrique URSSAF, véhicule électrique${maj}`;
  }
  return `Véhicule ${nom} — barème kilométrique URSSAF (≥ 7 CV)`;
}

export async function getNoteFraisData(clientId: string, debut: string, fin: string): Promise<NoteFraisData> {
  const d0 = new Date(`${debut}T00:00:00.000Z`);
  const [fy, fm, fd] = fin.split("-").map(Number);
  const d1 = new Date(Date.UTC(fy, fm - 1, fd + 1)); // exclusif → la date de fin est incluse
  const tous = !clientId || clientId === "tous";

  const [settings, deps, clientObj] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.deplacement.findMany({
      where: { dateDeplacement: { gte: d0, lt: d1 }, ...(tous ? {} : { activity: { clientId } }) },
      include: { activity: { include: { client: true } } },
      orderBy: { dateDeplacement: "asc" },
    }),
    tous ? Promise.resolve(null) : prisma.client.findUnique({ where: { id: clientId } }),
  ]);

  const baremeFor = (v: string | null) =>
    (v === "NISSAN_ARIYA_3CV" ? settings?.baremeNissanAriya : v === "VW_SHARAN_8CV" ? settings?.baremeVwSharan : null) as unknown as Bareme | null;

  const vehOrder: string[] = [];
  for (const d of deps) if (d.vehicule && !vehOrder.includes(d.vehicule)) vehOrder.push(d.vehicule);
  const markerOf = new Map(vehOrder.map((v, i) => [v, i + 1]));
  const footnotes: Footnote[] = vehOrder.map((v, i) => ({ index: i + 1, label: footnoteLabel(v, baremeFor(v)) }));

  const lignes: LigneNF[] = deps.map((d) => ({
    date: d.dateDeplacement.toLocaleDateString("fr-FR"),
    client: d.activity.client.raisonSociale,
    nature: d.description ?? d.activity.commentaire ?? "",
    paiement: d.moyenPaiement ? PAIE[d.moyenPaiement] ?? "" : "",
    km: d.kmTotal,
    compensation: d.indemniteKm ?? 0,
    transport: d.fraisTransport ?? 0,
    parking: d.fraisParking ?? 0,
    repas: d.fraisRepas ?? 0,
    hotel: d.fraisHotel ?? 0,
    divers: d.fraisDivers ?? 0,
    stotal: d.totalFrais ?? 0,
    marker: d.vehicule ? markerOf.get(d.vehicule) ?? null : null,
  }));

  const totaux: Totaux = lignes.reduce(
    (t, l) => ({
      km: t.km + (l.km ?? 0),
      compensation: t.compensation + l.compensation,
      transport: t.transport + l.transport,
      parking: t.parking + l.parking,
      repas: t.repas + l.repas,
      hotel: t.hotel + l.hotel,
      divers: t.divers + l.divers,
      stotal: t.stotal + l.stotal,
    }),
    { km: 0, compensation: 0, transport: 0, parking: 0, repas: 0, hotel: 0, divers: 0, stotal: 0 }
  );

  const sameMonth = debut.slice(0, 7) === fin.slice(0, 7) && debut.slice(8) === "01";
  let periodeLabel: string;
  if (sameMonth) {
    const [y, m] = debut.split("-").map(Number);
    periodeLabel = `${MOIS[m - 1]} ${y}`;
  } else {
    periodeLabel = `du ${d0.toLocaleDateString("fr-FR")} au ${new Date(`${fin}T00:00:00.000Z`).toLocaleDateString("fr-FR")}`;
  }

  const multiClient = tous || new Set(deps.map((d) => d.activity.clientId)).size > 1;
  const clientLabel = tous ? "Tous les clients" : clientObj?.raisonSociale ?? "";
  const fichierSlug = (tous ? "tous-clients" : clientObj?.raisonSociale ?? "client").replace(/[^a-z0-9]+/gi, "_") + `_${debut}_${fin}`;

  return {
    clientLabel,
    multiClient,
    periodeLabel,
    dateDemande: new Date().toLocaleDateString("fr-FR"),
    nomConsultant: settings?.nomConsultant ?? "Frédéric WOEHREL",
    titreConsultant: settings?.titreConsultant ?? "Consultant",
    adresse: settings?.adresseDomicile ?? "",
    titulaireCompte: settings?.titulaireCompte ?? "",
    iban: settings?.iban ?? "",
    bic: settings?.bic ?? "",
    total: totaux.stotal,
    lignes,
    totaux,
    footnotes,
    fichierSlug,
  };
}
