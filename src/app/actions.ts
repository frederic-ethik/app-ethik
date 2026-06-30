"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { dureeHeures, parisParts, parisWallDate, formatHM, MOIS } from "@/lib/format";
import { indemniteKm, type Bareme } from "@/lib/bareme";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";

const MODELE_IA = "claude-sonnet-4-6"; // modèle de rédaction (modifiable)

type ActSynthese = { dureeH: number; commentaire: string | null; missionType: { categorie: string; objet: string } | null };

// Rédaction par l'IA de la synthèse d'activité sur une période (mensuelle ou personnalisée).
// Renvoie le texte ; ne persiste rien.
async function redigerSynthese(raisonSociale: string, periodeLabel: string, acts: ActSynthese[], amorce: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Clé API Anthropic manquante. Ajoutez ANTHROPIC_API_KEY dans le fichier .env.");
  }
  if (acts.length === 0) {
    throw new Error("Aucune activité sur cette période : rien à synthétiser.");
  }

  // Regroupement des commentaires par Catégorie › Objet, avec durées
  const groupes = new Map<string, { duree: number; commentaires: string[] }>();
  for (const a of acts) {
    const cle = a.missionType ? `${a.missionType.categorie} › ${a.missionType.objet}` : "Autre";
    const g = groupes.get(cle) ?? { duree: 0, commentaires: [] };
    g.duree += a.dureeH;
    if (a.commentaire?.trim()) g.commentaires.push(a.commentaire.trim());
    groupes.set(cle, g);
  }

  let detail = "";
  for (const [cle, g] of groupes) {
    detail += `\n## ${cle} (${formatHM(g.duree)})\n`;
    detail += g.commentaires.length ? g.commentaires.map((c) => `- ${c}`).join("\n") : "- (pas de commentaire détaillé)";
    detail += "\n";
  }

  const system =
    "Tu es Frédéric WOEHREL, consultant indépendant (Ethik & Co). " +
    "Tu rédiges la synthèse de ton activité destinée à être envoyée par email à ton client. " +
    "Écris à la première personne, sur un ton professionnel, et SYNTHÉTIQUE (pas de paragraphes rédigés). " +
    `Format imposé : commence EXACTEMENT par la ligne « ${amorce} » ` +
    "puis présente l'activité sous forme de points courts (puces commençant par « - »), regroupés par catégorie d'activité " +
    "(intitule chaque catégorie sur sa propre ligne, suivie de ses puces). " +
    "Chaque point doit être bref et factuel. " +
    "N'utilise AUCUNE mise en forme Markdown (pas d'astérisques ** pour le gras, pas de #) : écris les intitulés de catégorie en texte simple, suivis du total d'heures entre parenthèses. " +
    "Base-toi UNIQUEMENT sur les activités et commentaires fournis — n'invente rien. " +
    "Pas de formule d'appel ni de signature (ni \"Bonjour\", ni \"Cordialement\"), pas de séparateur (\"---\").";

  const prompt =
    `Client : ${raisonSociale}\n` +
    `Période : ${periodeLabel}\n\n` +
    `Activités réalisées (par catégorie, avec durées et commentaires) :\n${detail}\n\n` +
    `Rédige la synthèse correspondante.`;

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: MODELE_IA,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// Création d'une activité en mode rattrapage (heures saisies manuellement)
export async function createActivite(formData: FormData) {
  const dateAct = String(formData.get("date") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const missionTypeId = String(formData.get("missionTypeId") ?? "");
  const debut = String(formData.get("debut") ?? "");
  const fin = String(formData.get("fin") ?? "");
  const commentaire = String(formData.get("commentaire") ?? "").trim();
  const suivant = String(formData.get("suivant") ?? "");

  if (!dateAct || !clientId || !debut || !fin) {
    throw new Error("Merci de renseigner la date, le client et les heures de début et de fin.");
  }

  await prisma.activity.create({
    data: {
      dateAct: new Date(`${dateAct}T00:00:00.000Z`),
      debutAct: new Date(`${dateAct}T${debut}:00.000Z`),
      finAct: new Date(`${dateAct}T${fin}:00.000Z`),
      dureeH: dureeHeures(debut, fin),
      clientId,
      missionTypeId: missionTypeId || null,
      commentaire: commentaire || null,
      hasDeplacement: formData.get("hasDeplacement") === "on",
    },
  });

  revalidatePath("/journal");
  revalidatePath("/");
  // "Enregistrer et suivant" : on revient sur la saisie, même client, début = fin précédente
  if (suivant) {
    const params = new URLSearchParams({ mode: "rattrapage", client: clientId, date: dateAct, debut: fin, ok: "1" });
    redirect(`/saisie?${params.toString()}`);
  }
  redirect("/journal?ok=1");
}

// Démarrage d'une session de badgeage (déclenché dès le choix du client)
export async function startBadgeage(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const missionTypeId = String(formData.get("missionTypeId") ?? "");
  if (!clientId) throw new Error("Merci de choisir un client avant de démarrer.");

  const enCours = await prisma.activity.findFirst({ where: { finAct: null } });
  if (enCours) redirect("/journal?encours=1");

  const now = new Date();
  const { date: dateStr } = parisParts(now);
  await prisma.activity.create({
    data: {
      dateAct: new Date(`${dateStr}T00:00:00.000Z`),
      debutAct: parisWallDate(now),
      finAct: null,
      dureeH: 0,
      clientId,
      missionTypeId: missionTypeId || null,
      hasDeplacement: false,
    },
  });

  revalidatePath("/");
  redirect("/?demarre=1");
}

// Finalisation d'une session de badgeage : l'heure de fin = MAINTENANT (à la validation),
// et on enregistre le commentaire / type. Optionnellement, on enchaîne sur une nouvelle session.
export async function finaliserActivite(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const dateAct = String(formData.get("date") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const missionTypeId = String(formData.get("missionTypeId") ?? "");
  const debut = String(formData.get("debut") ?? "");
  const commentaire = String(formData.get("commentaire") ?? "").trim();
  const next = String(formData.get("next") ?? "");

  if (!id || !dateAct || !clientId || !debut) {
    throw new Error("Informations manquantes pour finaliser l'activité.");
  }

  const fin = parisParts(new Date()).time.slice(0, 5); // HH:MM au moment de la validation

  await prisma.activity.update({
    where: { id },
    data: {
      dateAct: new Date(`${dateAct}T00:00:00.000Z`),
      debutAct: new Date(`${dateAct}T${debut}:00.000Z`),
      finAct: new Date(`${dateAct}T${fin}:00.000Z`),
      dureeH: dureeHeures(debut, fin),
      clientId,
      missionTypeId: missionTypeId || null,
      commentaire: commentaire || null,
      hasDeplacement: formData.get("hasDeplacement") === "on",
    },
  });

  revalidatePath("/");
  revalidatePath("/journal");
  if (next) redirect(`/saisie?client=${encodeURIComponent(next)}&mode=badgeage`);
  redirect("/journal?ok=1");
}

// Modification d'une activité déjà clôturée (depuis le journal, via le crayon)
export async function updateActivite(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const dateAct = String(formData.get("date") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const missionTypeId = String(formData.get("missionTypeId") ?? "");
  const debut = String(formData.get("debut") ?? "");
  const fin = String(formData.get("fin") ?? "");
  const commentaire = String(formData.get("commentaire") ?? "").trim();

  if (!id || !dateAct || !clientId || !debut || !fin) {
    throw new Error("Merci de renseigner la date, le client et les heures de début et de fin.");
  }

  const hasDeplacement = formData.get("hasDeplacement") === "on";

  await prisma.activity.update({
    where: { id },
    data: {
      dateAct: new Date(`${dateAct}T00:00:00.000Z`),
      debutAct: new Date(`${dateAct}T${debut}:00.000Z`),
      finAct: new Date(`${dateAct}T${fin}:00.000Z`),
      dureeH: dureeHeures(debut, fin),
      clientId,
      missionTypeId: missionTypeId || null,
      commentaire: commentaire || null,
      hasDeplacement,
    },
  });

  // Si on retire le marqueur alors que des frais avaient été saisis, on supprime le déplacement
  // pour éviter des frais "cachés" (la voiture n'apparaît plus dans le journal).
  if (!hasDeplacement) await prisma.deplacement.deleteMany({ where: { activityId: id } });

  revalidatePath("/journal");
  revalidatePath("/");
  redirect("/journal?ok=1");
}

// Validation manuelle du nombre de jours travaillés d'un mois (rapport client)
export async function validerJoursRapport(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const annee = Number(formData.get("annee"));
  const mois = Number(formData.get("mois"));
  const raw = String(formData.get("joursValides") ?? "").replace(",", ".").trim();
  const joursValides = raw === "" ? null : Number(raw);

  if (!clientId || !annee || !mois) return;

  await prisma.rapportMensuel.upsert({
    where: { clientId_annee_mois: { clientId, annee, mois } },
    update: { joursValides },
    create: { clientId, annee, mois, joursValides },
  });

  revalidatePath("/rapports");
  redirect(`/rapports?client=${encodeURIComponent(clientId)}&mois=${annee}-${String(mois).padStart(2, "0")}&saved=1`);
}

// Génération de la synthèse narrative du mois par l'IA (API Claude)
export async function genererSynthese(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const annee = Number(formData.get("annee"));
  const mois = Number(formData.get("mois"));
  if (!clientId || !annee || !mois) return;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  const debut = new Date(Date.UTC(annee, mois - 1, 1));
  const fin = new Date(Date.UTC(annee, mois, 1));
  const acts = await prisma.activity.findMany({
    where: { clientId, dateAct: { gte: debut, lt: fin } },
    include: { missionType: true },
    orderBy: [{ dateAct: "asc" }, { debutAct: "asc" }],
  });

  const texte = await redigerSynthese(
    client?.raisonSociale ?? "",
    `${MOIS[mois - 1]} ${annee}`,
    acts,
    "Ci-dessous, l'essentiel de mon activité sur le mois :",
  );

  await prisma.rapportMensuel.upsert({
    where: { clientId_annee_mois: { clientId, annee, mois } },
    update: { syntheseValidee: texte, syntheseValideAt: new Date() },
    create: { clientId, annee, mois, syntheseValidee: texte, syntheseValideAt: new Date() },
  });

  revalidatePath("/rapports");
  redirect(`/rapports?client=${encodeURIComponent(clientId)}&mois=${annee}-${String(mois).padStart(2, "0")}`);
}

// Synthèse sur une période personnalisée (date à date). Générée à la volée : renvoie
// le texte au composant client, ne stocke rien en base.
export async function genererSynthesePeriode(clientId: string, debutISO: string, finISO: string): Promise<string> {
  if (!clientId || !debutISO || !finISO) {
    throw new Error("Période incomplète.");
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  const debut = new Date(`${debutISO}T00:00:00.000Z`);
  const finExclusive = new Date(`${finISO}T00:00:00.000Z`);
  finExclusive.setUTCDate(finExclusive.getUTCDate() + 1); // borne haute incluse
  const acts = await prisma.activity.findMany({
    where: { clientId, dateAct: { gte: debut, lt: finExclusive } },
    include: { missionType: true },
    orderBy: [{ dateAct: "asc" }, { debutAct: "asc" }],
  });

  const frDate = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  return redigerSynthese(
    client?.raisonSociale ?? "",
    `du ${frDate(debut)} au ${frDate(new Date(`${finISO}T00:00:00.000Z`))}`,
    acts,
    "Ci-dessous, l'essentiel de mon activité sur la période :",
  );
}

// Enregistrement de la synthèse éditée manuellement
export async function validerSynthese(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const annee = Number(formData.get("annee"));
  const mois = Number(formData.get("mois"));
  const texte = String(formData.get("texte") ?? "");
  if (!clientId || !annee || !mois) return;

  await prisma.rapportMensuel.upsert({
    where: { clientId_annee_mois: { clientId, annee, mois } },
    update: { syntheseValidee: texte, syntheseValideAt: new Date() },
    create: { clientId, annee, mois, syntheseValidee: texte, syntheseValideAt: new Date() },
  });

  revalidatePath("/rapports");
  redirect(`/rapports?client=${encodeURIComponent(clientId)}&mois=${annee}-${String(mois).padStart(2, "0")}&saved=1`);
}

// Enregistrement des réglages (ligne unique « singleton »)
export async function enregistrerReglages(formData: FormData) {
  const txt = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const num = (k: string, def: number) => {
    const v = String(formData.get(k) ?? "").replace(",", ".").trim();
    return v === "" || Number.isNaN(Number(v)) ? def : Number(v);
  };

  // Reconstruction d'un barème en préservant les "constantes" existantes (non éditées ici)
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const baremeFromForm = (prefix: string, existant: unknown): Bareme => {
    const ex = (existant as Bareme | null) ?? { tranches: [] };
    const tr = ex.tranches ?? [];
    const taux = (k: string) => num(k, 0);
    return {
      puissanceFiscale: txt(`${prefix}_pf`) ?? ex.puissanceFiscale ?? "",
      electrique: formData.get(`${prefix}_elec`) === "on",
      majoration: num(`${prefix}_maj`, 0) / 100, // saisi en %, stocké en décimal
      tranches: [
        { max: 5000, taux: taux(`${prefix}_t1`), constante: tr[0]?.constante ?? 0 },
        { max: 20000, taux: taux(`${prefix}_t2`), constante: tr[1]?.constante ?? 0 },
        { max: null, taux: taux(`${prefix}_t3`), constante: tr[2]?.constante ?? 0 },
      ],
    };
  };

  const data = {
    nomConsultant: txt("nomConsultant"),
    titreConsultant: txt("titreConsultant"),
    adresseDomicile: txt("adresseDomicile"),
    titulaireCompte: txt("titulaireCompte"),
    iban: txt("iban"),
    bic: txt("bic"),
    dureeJourneeH: num("dureeJourneeH", 7),
    seuilAlerteJours: Math.round(num("seuilAlerteJours", 7)),
    demiJMatinFinMin: Math.round(num("demiJMatinFin", 810)),
    demiJApremDebutMin: Math.round(num("demiJApremDebut", 720)),
    demiJSeuilMin: Math.round(num("demiJSeuil", 90)),
    baremeNissanAriya: baremeFromForm("ariya", settings?.baremeNissanAriya) as unknown as object,
    baremeVwSharan: baremeFromForm("sharan", settings?.baremeVwSharan) as unknown as object,
  };

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidatePath("/reglages");
  revalidatePath("/note-frais");
  revalidatePath("/journal");
  revalidatePath("/");
  redirect("/reglages?saved=1");
}

// Enregistrement (création/édition) d'un déplacement rattaché à une activité
export async function enregistrerDeplacement(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  if (!activityId) return;

  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").replace(",", ".").trim();
    return v === "" || Number.isNaN(Number(v)) ? null : Number(v);
  };
  const dateDeplacement = String(formData.get("date") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;
  const vehiculeRaw = String(formData.get("vehicule") ?? "");
  const vehicule = vehiculeRaw === "NISSAN_ARIYA_3CV" || vehiculeRaw === "VW_SHARAN_8CV" ? vehiculeRaw : null;
  const lieuDepart = String(formData.get("lieuDepart") ?? "").trim() || null;
  const lieuArrivee = String(formData.get("lieuArrivee") ?? "").trim() || null;
  const kmAller = num("kmAller");
  const kmRetour = num("kmRetour");
  const kmTotal = vehicule ? (kmAller ?? 0) + (kmRetour ?? 0) : null;
  const fraisTransport = num("fraisTransport");
  const fraisParking = num("fraisParking");
  const fraisRepas = num("fraisRepas");
  const fraisHotel = num("fraisHotel");
  const fraisDivers = num("fraisDivers");
  const moyenRaw = String(formData.get("moyenPaiement") ?? "");
  const moyenPaiement = ["CARTE", "ESPECES", "CHEQUE", "NC"].includes(moyenRaw) ? moyenRaw : null;

  if (!dateDeplacement) throw new Error("La date du déplacement est requise.");

  // Indemnité kilométrique URSSAF (selon véhicule + cumul annuel)
  let indemnite = 0;
  if (vehicule && kmTotal && kmTotal > 0) {
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    const bareme = (vehicule === "NISSAN_ARIYA_3CV" ? settings?.baremeNissanAriya : settings?.baremeVwSharan) as unknown as Bareme | null;
    if (bareme) {
      const annee = Number(dateDeplacement.slice(0, 4));
      const debut = new Date(Date.UTC(annee, 0, 1));
      const fin = new Date(Date.UTC(annee + 1, 0, 1));
      const agg = await prisma.deplacement.aggregate({
        _sum: { kmTotal: true },
        where: { vehicule: vehicule as never, dateDeplacement: { gte: debut, lt: fin }, NOT: { activityId } },
      });
      indemnite = indemniteKm(bareme, kmTotal, agg._sum.kmTotal ?? 0);
    }
  }
  const totalFrais =
    Math.round((indemnite + (fraisTransport ?? 0) + (fraisParking ?? 0) + (fraisRepas ?? 0) + (fraisHotel ?? 0) + (fraisDivers ?? 0)) * 100) / 100;

  const data = {
    dateDeplacement: new Date(`${dateDeplacement}T00:00:00.000Z`),
    description,
    vehicule: vehicule as never,
    lieuDepart,
    lieuArrivee,
    kmAller,
    kmRetour,
    kmTotal,
    indemniteKm: indemnite,
    fraisTransport,
    fraisParking,
    fraisRepas,
    fraisHotel,
    fraisDivers,
    totalFrais,
    moyenPaiement: moyenPaiement as never,
  };

  await prisma.deplacement.upsert({ where: { activityId }, update: data, create: { activityId, ...data } });
  await prisma.activity.update({ where: { id: activityId }, data: { hasDeplacement: true } });

  revalidatePath("/journal");
  revalidatePath("/");
  redirect("/journal?ok=1");
}

// Suppression d'un déplacement
export async function supprimerDeplacement(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  if (!activityId) return;
  await prisma.deplacement.deleteMany({ where: { activityId } });
  await prisma.activity.update({ where: { id: activityId }, data: { hasDeplacement: false } });
  revalidatePath("/journal");
  revalidatePath("/");
  redirect("/journal?ok=1");
}

// Suppression d'une activité (depuis le journal)
export async function supprimerActivite(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.activity.delete({ where: { id } });
  revalidatePath("/journal");
  revalidatePath("/");
}

// ===================== GESTION DES CLIENTS & TYPES DE MISSIONS =====================

const TYPE_CLIENT_VALS = ["ESS_ASSO", "ESS_SCOOP", "SECTEUR_MARCHAND", "NON_FACTURABLE", "NON_FACTURE"];
const TYPE_FACT_VALS = ["HORAIRE", "REFACTURATION_REEL", "NON_FACTURE"];

// Création ou modification d'un client (id="nouveau" ou absent → création)
export async function enregistrerClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const txt = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const raisonSociale = txt("raisonSociale");
  if (!raisonSociale) throw new Error("La raison sociale est obligatoire.");

  const tc = String(formData.get("typeClient") ?? "");
  const cibleRaw = String(formData.get("cibleJoursMensuelle") ?? "").replace(",", ".").trim();

  const data = {
    raisonSociale,
    siret: txt("siret"),
    typeClient: (TYPE_CLIENT_VALS.includes(tc) ? tc : "NON_FACTURE") as never,
    adresse: txt("adresse"),
    codePostal: txt("codePostal"),
    ville: txt("ville"),
    contactNom: txt("contactNom"),
    contactPrenom: txt("contactPrenom"),
    contactTitre: txt("contactTitre"),
    contactEmail: txt("contactEmail"),
    contactTelephone: txt("contactTelephone"),
    cibleJoursMensuelle: cibleRaw === "" || Number.isNaN(Number(cibleRaw)) ? null : Number(cibleRaw),
    actif: formData.get("actif") === "on",
    estStructure: formData.get("estStructure") === "on",
  };

  let cid = id;
  if (id && id !== "nouveau") {
    await prisma.client.update({ where: { id }, data });
  } else {
    const c = await prisma.client.create({ data });
    cid = c.id;
  }

  revalidatePath("/clients");
  revalidatePath("/");
  redirect(`/clients/${cid}?saved=1`);
}

// Archiver / réactiver un client (on n'efface jamais : il est lié aux activités historiques)
export async function basculerClientActif(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const c = await prisma.client.findUnique({ where: { id }, select: { actif: true } });
  await prisma.client.update({ where: { id }, data: { actif: !c?.actif } });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

// Création ou modification d'un type de mission (rattaché à un client)
export async function enregistrerMissionType(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const mid = String(formData.get("mid") ?? "");
  const categorie = String(formData.get("categorie") ?? "").trim();
  const objet = String(formData.get("objet") ?? "").trim();
  if (!clientId || !categorie || !objet) throw new Error("La catégorie et l'objet sont obligatoires.");

  const tf = String(formData.get("typeFacturation") ?? "");
  const data = {
    categorie,
    objet,
    detail: String(formData.get("detail") ?? "").trim() || null,
    typeFacturation: (TYPE_FACT_VALS.includes(tf) ? tf : "NON_FACTURE") as never,
  };

  if (mid) await prisma.missionType.update({ where: { id: mid }, data });
  else await prisma.missionType.create({ data: { clientId, ...data } });

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?saved=1`);
}

// Archiver / réactiver un type de mission (jamais d'effacement : lié aux activités)
export async function basculerMissionType(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!id) return;
  const m = await prisma.missionType.findUnique({ where: { id }, select: { actif: true } });
  await prisma.missionType.update({ where: { id }, data: { actif: !m?.actif } });
  revalidatePath(`/clients/${clientId}`);
}

// ===================== ACCÈS CLIENT (lien public en lecture seule) =====================

const nouveauToken = () => randomBytes(16).toString("hex");

// Active/désactive l'accès et enregistre les sections visibles par le client
export async function enregistrerAccesClient(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const accesActif = formData.get("accesActif") === "on";

  const data: {
    accesActif: boolean;
    accesSynthese: boolean;
    accesTableau: boolean;
    accesDetail: boolean;
    accesJours: boolean;
    tokenAcces?: string;
  } = {
    accesActif,
    accesSynthese: formData.get("accesSynthese") === "on",
    accesTableau: formData.get("accesTableau") === "on",
    accesDetail: formData.get("accesDetail") === "on",
    accesJours: formData.get("accesJours") === "on",
  };

  // Génère un jeton la première fois qu'on active l'accès
  if (accesActif) {
    const c = await prisma.client.findUnique({ where: { id }, select: { tokenAcces: true } });
    if (!c?.tokenAcces) data.tokenAcces = nouveauToken();
  }

  await prisma.client.update({ where: { id }, data });
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}?saved=1`);
}

// Régénère le jeton (invalide l'ancien lien)
export async function regenererTokenAcces(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.client.update({ where: { id }, data: { tokenAcces: nouveauToken() } });
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}?saved=1`);
}
