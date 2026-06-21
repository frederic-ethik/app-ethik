// Calcul de l'indemnité kilométrique selon le barème URSSAF.
// Le barème est progressif sur le cumul annuel de km (tranches 0–5000 / 5001–20000 / >20000).
// On répartit les km du trajet sur les tranches selon le cumul déjà parcouru dans l'année.

export type Tranche = { max: number | null; taux: number; constante: number };
export type Bareme = {
  puissanceFiscale?: string;
  electrique?: boolean;
  majoration?: number; // ex. 0.2 pour +20 % (véhicule électrique)
  tranches: Tranche[];
};

export function indemniteKm(bareme: Bareme, kmTrajet: number, cumulAvant: number): number {
  if (!bareme?.tranches?.length || kmTrajet <= 0) return 0;
  let reste = kmTrajet;
  let cumul = Math.max(0, cumulAvant);
  let total = 0;
  for (const t of bareme.tranches) {
    const plafond = t.max ?? Infinity;
    if (cumul >= plafond) continue;
    const part = Math.min(reste, plafond - cumul);
    total += part * t.taux;
    cumul += part;
    reste -= part;
    if (reste <= 0) break;
  }
  const majore = total * (1 + (bareme.majoration ?? 0));
  return Math.round(majore * 100) / 100;
}
