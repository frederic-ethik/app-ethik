"use server";

import { prisma } from "@/lib/prisma";
import { dureeHeures, parisParts, parisWallDate } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

// Suppression d'une activité (depuis le journal)
export async function supprimerActivite(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.activity.delete({ where: { id } });
  revalidatePath("/journal");
  revalidatePath("/");
}
