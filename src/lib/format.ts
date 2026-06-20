export const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

// Durée décimale entre deux heures "HH:MM"
export function dureeHeures(debut: string, fin: string): number {
  if (!debut || !fin) return 0;
  const [dh, dm] = debut.split(":").map(Number);
  const [fh, fm] = fin.split(":").map(Number);
  let mins = fh * 60 + fm - (dh * 60 + dm);
  if (mins < 0) mins += 1440;
  return Math.round((mins / 60) * 100) / 100;
}

// "2,25 h (2h15)"
export function formatHeures(h: number): string {
  const dec = h.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return `${dec} h (${heures}h${min.toString().padStart(2, "0")})`;
}

// "2,25 h"
export function formatHeuresCourt(h: number): string {
  return `${h.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`;
}

// Heure "HH:MM" à partir d'un timestamp stocké (lecture en UTC pour rester fidèle à la saisie)
export function heureDe(d: Date): string {
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
}
