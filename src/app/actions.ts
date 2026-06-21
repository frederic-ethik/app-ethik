"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { dureeHeures, parisParts, parisWallDate, formatHeuresCourt, MOIS } from "@/lib/format";
import { indemniteKm, type Bareme } from "@/lib/bareme";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const MODELE_IA = "claude-sonnet-4-6"; // modèle de rédaction (modifiable)

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
      hasDeplacement: false,
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
    },
  });

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

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Clé API Anthropic manquante. Ajoutez ANTHROPIC_API_KEY dans le fichier .env.");
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  const debut = new Date(Date.UTC(annee, mois - 1, 1));
  const fin = new Date(Date.UTC(annee, mois, 1));
  const acts = await prisma.activity.findMany({
    where: { clientId, dateAct: { gte: debut, lt: fin } },
    include: { missionType: true },
    orderBy: [{ dateAct: "asc" }, { debutAct: "asc" }],
  });

  if (acts.length === 0) {
    throw new Error("Aucune activité ce mois-ci : rien à synthétiser.");
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
    detail += `\n## ${cle} (${formatHeuresCourt(g.duree)})\n`;
    detail += g.commentaires.length ? g.commentaires.map((c) => `- ${c}`).join("\n") : "- (pas de commentaire détaillé)";
    detail += "\n";
  }

  const system =
    "Tu es Frédéric WOEHREL, consultant indépendant (Ethik & Co). " +
    "Tu rédiges la synthèse mensuelle de ton activité destinée à être envoyée par email à ton client. " +
    "Écris à la première personne, sur un ton professionnel, et SYNTHÉTIQUE (pas de paragraphes rédigés). " +
    "Format imposé : commence EXACTEMENT par la ligne « Ci-dessous, l'essentiel de mon activité sur le mois : » " +
    "puis présente l'activité sous forme de points courts (puces commençant par « - »), regroupés par catégorie d'activité " +
    "(intitule chaque catégorie sur sa propre ligne, suivie de ses puces). " +
    "Chaque point doit être bref et factuel. " +
    "N'utilise AUCUNE mise en forme Markdown (pas d'astérisques ** pour le gras, pas de #) : écris les intitulés de catégorie en texte simple, suivis du total d'heures entre parenthèses. " +
    "Base-toi UNIQUEMENT sur les activités et commentaires fournis — n'invente rien. " +
    "Pas de formule d'appel ni de signature (ni \"Bonjour\", ni \"Cordialement\"), pas de séparateur (\"---\").";

  const prompt =
    `Client : ${client?.raisonSociale ?? ""}\n` +
    `Période : ${MOIS[mois - 1]} ${annee}\n\n` +
    `Activités réalisées (par catégorie, avec durées et commentaires) :\n${detail}\n\n` +
    `Rédige la synthèse mensuelle correspondante.`;

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: MODELE_IA,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const texte = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  await prisma.rapportMensuel.upsert({
    where: { clientId_annee_mois: { clientId, annee, mois } },
    update: { syntheseValidee: texte, syntheseValideAt: new Date() },
    create: { clientId, annee, mois, syntheseValidee: texte, syntheseValideAt: new Date() },
  });

  revalidatePath("/rapports");
  redirect(`/rapports?client=${encodeURIComponent(clientId)}&mois=${annee}-${String(mois).padStart(2, "0")}`);
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
