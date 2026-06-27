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

// Démarre une session de badgeage (chrono) pour un client.
// `depuis` (optionnel) : pour enchaîner sans coupure, le début = la fin de l'activité précédente.
export async function badgeDemarrer(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) redirect("/badge");

  const enCours = await prisma.activity.findFirst({ where: { finAct: null } });
  if (enCours) redirect("/badge"); // une session est déjà ouverte

  const maintenant = parisWallDate(new Date());
  let debutAct = maintenant;
  const depuisRaw = String(formData.get("depuis") ?? "");
  if (depuisRaw) {
    const d = new Date(depuisRaw);
    const diff = maintenant.getTime() - d.getTime();
    // on n'accepte la continuité que si c'est cohérent (dans le passé, < 24 h)
    if (!Number.isNaN(d.getTime()) && diff >= 0 && diff < 24 * 3600 * 1000) debutAct = d;
  }
  const dateStr = debutAct.toISOString().slice(0, 10);

  await prisma.activity.create({
    data: {
      dateAct: new Date(`${dateStr}T00:00:00.000Z`),
      debutAct,
      finAct: null,
      dureeH: 0,
      clientId,
      hasDeplacement: false,
    },
  });
  revalider();
  redirect("/badge");
}

// Termine la session en cours (fin = maintenant) avec type de mission, commentaire,
// marqueur de frais de déplacement. `enchainer` : repart aussitôt sur le choix du client suivant,
// sans coupure de temps.
export async function badgeTerminer(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/badge");
  const missionTypeId = String(formData.get("missionTypeId") ?? "");
  const commentaire = String(formData.get("commentaire") ?? "").trim();
  const hasDeplacement = formData.get("hasDeplacement") === "on";
  const enchainer = formData.get("enchainer") === "1";

  const act = await prisma.activity.findUnique({ where: { id }, select: { dateAct: true, debutAct: true, finAct: true } });
  if (!act || act.finAct) redirect("/badge");

  const dateStr = act.dateAct.toISOString().slice(0, 10);
  const debut = heureDe(act.debutAct);
  const fin = parisParts(new Date()).time.slice(0, 5);
  const finDate = new Date(`${dateStr}T${fin}:00.000Z`);

  await prisma.activity.update({
    where: { id },
    data: {
      finAct: finDate,
      dureeH: dureeHeures(debut, fin),
      missionTypeId: missionTypeId || null,
      commentaire: commentaire || null,
      hasDeplacement,
    },
  });
  revalider();

  if (enchainer) redirect(`/badge?depuis=${encodeURIComponent(finDate.toISOString())}`);
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
