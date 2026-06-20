"use server";

import { prisma } from "@/lib/prisma";
import { dureeHeures } from "@/lib/format";
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
  redirect("/journal?ok=1");
}

// Démarrage d'une session de badgeage (chrono en temps réel)
export async function startBadgeage(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const missionTypeId = String(formData.get("missionTypeId") ?? "");
  if (!clientId) throw new Error("Merci de choisir un client avant de démarrer.");

  const enCours = await prisma.activity.findFirst({ where: { finAct: null } });
  if (enCours) redirect("/journal?encours=1");

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  await prisma.activity.create({
    data: {
      dateAct: new Date(`${dateStr}T00:00:00.000Z`),
      debutAct: now,
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

// Fin d'une session de badgeage
export async function terminerBadgeage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const act = await prisma.activity.findUnique({ where: { id } });
  if (!act || act.finAct) return;

  const now = new Date();
  const dureeH = Math.round(((now.getTime() - act.debutAct.getTime()) / 3_600_000) * 100) / 100;
  await prisma.activity.update({
    where: { id },
    data: { finAct: now, dureeH },
  });

  revalidatePath("/");
  revalidatePath("/journal");
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
