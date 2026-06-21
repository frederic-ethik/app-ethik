// Calcul des demi-journées travaillées (indicateur INTERNE d'aide à la facturation —
// ne doit jamais être communiqué au client). Règle métier (cahier des charges, p.14) :
//   • Matin       = temps situé avant `matinFinMin`   (défaut 13h30)
//   • Après-midi  = temps situé après `apremDebutMin`  (défaut 12h00)
//   • Zone de chevauchement [apremDebut, matinFin] : attribuée ENTIÈREMENT au matin OU à
//     l'après-midi — jamais aux deux. La période qui en reçoit le plus de temps emporte tout.
//   • Une demi-journée (0,5 j) est comptée si le temps cumulé de la période dépasse le seuil.
//   • Cumul par jour : 0, 0,5 ou 1 journée.

export type RegleDemiJournee = {
  matinFinMin: number; // borne haute de la plage du matin (minutes depuis minuit)
  apremDebutMin: number; // borne basse de la plage de l'après-midi (minutes depuis minuit)
  seuilMin: number; // durée cumulée mini (minutes) pour déclencher une demi-journée
};

export const REGLE_DEMI_J_DEFAUT: RegleDemiJournee = { matinFinMin: 810, apremDebutMin: 720, seuilMin: 90 };

export type ActivitePlage = {
  jour: string; // identifiant du jour (ex. "2026-05-14")
  debutMin: number; // début en minutes depuis minuit
  finMin: number; // fin en minutes depuis minuit
};

// Répartit une plage [debut, fin] entre matin et après-midi selon la règle.
function repartir(debut: number, fin: number, r: RegleDemiJournee): { matin: number; aprem: number } {
  if (fin <= debut) return { matin: 0, aprem: 0 };
  const M = r.matinFinMin; // 13h30
  const A = r.apremDebutMin; // 12h00
  let matin = 0;
  let aprem = 0;

  if (A < M) {
    // Cas normal : zone de chevauchement [A, M]
    matin += Math.max(0, Math.min(fin, A) - debut); // avant A → matin pur
    aprem += Math.max(0, fin - Math.max(debut, M)); // après M → après-midi pur
    const cs = Math.max(debut, A);
    const ce = Math.min(fin, M);
    const litige = Math.max(0, ce - cs); // temps de la plage dans la zone de chevauchement
    if (litige > 0) {
      const pivot = (A + M) / 2; // centre de la zone
      const partMatin = Math.max(0, Math.min(ce, pivot) - cs);
      if (partMatin >= litige - partMatin) matin += litige;
      else aprem += litige;
    }
  } else {
    // Pas de chevauchement (configuration atypique) : un éventuel intervalle [M, A] n'est compté nulle part
    matin += Math.max(0, Math.min(fin, M) - debut);
    aprem += Math.max(0, fin - Math.max(debut, A));
  }
  return { matin, aprem };
}

// Demi-journées par jour : Map<jour, 0 | 0.5 | 1>
export function demiJourneesParJour(plages: ActivitePlage[], r: RegleDemiJournee): Map<string, number> {
  const cumul = new Map<string, { matin: number; aprem: number }>();
  for (const p of plages) {
    if (p.finMin <= p.debutMin) continue;
    const g = cumul.get(p.jour) ?? { matin: 0, aprem: 0 };
    const { matin, aprem } = repartir(p.debutMin, p.finMin, r);
    g.matin += matin;
    g.aprem += aprem;
    cumul.set(p.jour, g);
  }
  const res = new Map<string, number>();
  for (const [jour, g] of cumul) {
    let j = 0;
    if (g.matin > r.seuilMin) j += 0.5;
    if (g.aprem > r.seuilMin) j += 0.5;
    res.set(jour, j);
  }
  return res;
}

// Total des demi-journées sur un ensemble de plages.
export function totalDemiJournees(plages: ActivitePlage[], r: RegleDemiJournee): number {
  let total = 0;
  for (const v of demiJourneesParJour(plages, r).values()) total += v;
  return total;
}

// Confort : minutes depuis minuit ⇄ "HH:MM"
export const minToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const hhmmToMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
