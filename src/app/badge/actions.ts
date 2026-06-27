"use server";

import { prisma } from "@/lib/prisma";
import { dureeHeures, parisParts, parisWallDate, heureDe } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function revalider() {
  revalidatePath("/badge");
  revalidatePath("/");
  revalidatePath("/journal");
}

// Démarre une session de badgeage (chrono) pour un client
export async function badgeDemarrer(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) redirect("/badge");

  const enCours = await prisma.activity.findFirst({ where: { finAct: null } });
  if (enCours) redirect("/badge"); // une session est déjà ouverte

  const now = new Date();
  const { date } = parisParts(now);
  await prisma.activity.create({
    data: {
      dateAct: new Date(`${date}T00:00:00.000Z`),
      debutAct: parisWallDate(now),
      finAct: null,
      dureeH: 0,
      clientId,
      hasDeplacement: false,
    },
  });
  revalider();
  redirect("/badge");
}

// Termine la session en cours (heure de fin = maintenant) avec type de mission + commentaire
export async function badgeTerminer(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/badge");
  const missionTypeId = String(formData.get("missionTypeId") ?? "");
  const commentaire = String(formData.get("commentaire") ?? "").trim();

  const act = await prisma.activity.findUnique({ where: { id }, select: { dateAct: true, debutAct: true, finAct: true } });
  if (!act || act.finAct) redirect("/badge");

  const dateStr = act.dateAct.toISOString().slice(0, 10);
  const debut = heureDe(act.debutAct);
  const fin = parisParts(new Date()).time.slice(0, 5);

  await prisma.activity.update({
    where: { id },
    data: {
      finAct: new Date(`${dateStr}T${fin}:00.000Z`),
      dureeH: dureeHeures(debut, fin),
      missionTypeId: missionTypeId || null,
      commentaire: commentaire || null,
    },
  });
  revalider();
  redirect("/badge?ok=1");
}

// Annule une session ouverte par erreur (supprime l'activité non terminée)
export async function badgeAnnuler(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/badge");
  await prisma.activity.deleteMany({ where: { id, finAct: null } });
  revalider();
  redirect("/badge");
}
