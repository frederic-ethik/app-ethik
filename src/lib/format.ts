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

// "20h52" — format compact pour les tableaux de synthèse
export function formatHM(h: number): string {
  if (!h) return "–";
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  if (M === 60) return `${H + 1}h`;
  return M === 0 ? `${H}h` : `${H}h${String(M).padStart(2, "0")}`;
}

// Heure "HH:MM" à partir d'un timestamp stocké (lecture en UTC pour rester fidèle à la saisie)
export function heureDe(d: Date): string {
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
}

// Heure murale Europe/Paris d'un instant réel (robuste quel que soit le fuseau du serveur)
export function parisParts(d: Date): { date: string; time: string } {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` };
}

// Convertit un instant en heure murale Europe/Paris, stockée comme timestamp UTC-étiqueté
// (cohérent avec la saisie manuelle, qui enregistre l'heure telle que tapée)
export function parisWallDate(d: Date): Date {
  const { date, time } = parisParts(d);
  return new Date(`${date}T${time}.000Z`);
}
