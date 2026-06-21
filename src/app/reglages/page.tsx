import { prisma } from "@/lib/prisma";
import { enregistrerReglages } from "@/app/actions";
import type { Bareme } from "@/lib/bareme";
import ReglesDemiJournee from "@/components/ReglesDemiJournee";
import { REGLE_DEMI_J_DEFAUT } from "@/lib/demi-journees";

export const dynamic = "force-dynamic";

export default async function ReglagesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const s = await prisma.settings.findUnique({ where: { id: "singleton" } });

  const ariya = (s?.baremeNissanAriya as unknown as Bareme | null) ?? null;
  const sharan = (s?.baremeVwSharan as unknown as Bareme | null) ?? null;
  const taux = (b: Bareme | null, i: number) => (b?.tranches?.[i]?.taux ?? "").toString();
  const majPct = (b: Bareme | null) => (b?.majoration ? Math.round(b.majoration * 100) : 0).toString();

  const card = { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "20px 22px", marginBottom: 20 } as const;
  const cardTitle = { fontSize: 15, fontWeight: 600, color: "#0077a8", margin: "0 0 14px" } as const;
  const label = { fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 4 } as const;
  const field = { fontSize: 14, padding: "9px 11px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8, background: "#fff", color: "#595959", width: "100%", boxSizing: "border-box" } as const;
  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as const;
  const grid3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 } as const;
  const hint = { fontSize: 12, color: "#a5a5a5", margin: "2px 0 0" } as const;

  // Champ texte simple réutilisable
  const Field = ({ name, lbl, def, ph, type = "text", step }: { name: string; lbl: string; def?: string | null; ph?: string; type?: string; step?: string }) => (
    <div>
      <label style={label}>{lbl}</label>
      <input name={name} defaultValue={def ?? ""} placeholder={ph} type={type} step={step} style={field} />
    </div>
  );

  // Bloc d'édition d'un barème véhicule
  const BaremeBloc = ({ prefix, b, nomFixe }: { prefix: string; b: Bareme | null; nomFixe: string }) => (
    <div style={{ border: "1px solid rgba(0,0,0,.08)", borderRadius: 10, padding: "14px 16px", marginBottom: 14, background: "#fafbfc" }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#595959", margin: "0 0 12px" }}>{nomFixe}</p>
      <div style={{ ...grid3, marginBottom: 14 }}>
        <div>
          <label style={label}>Puissance fiscale</label>
          <input name={`${prefix}_pf`} defaultValue={b?.puissanceFiscale ?? ""} placeholder="ex. 3CV" style={field} />
        </div>
        <div>
          <label style={label}>Majoration (%)</label>
          <input name={`${prefix}_maj`} defaultValue={majPct(b)} type="number" step="1" style={field} />
          <p style={hint}>Surcoût électrique (ex. 20)</p>
        </div>
        <div>
          <label style={label}>Véhicule électrique</label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#595959", padding: "9px 0" }}>
            <input name={`${prefix}_elec`} type="checkbox" defaultChecked={!!b?.electrique} style={{ width: 16, height: 16 }} />
            Oui
          </label>
        </div>
      </div>
      <p style={{ ...label, marginBottom: 8 }}>Taux par km selon le cumul annuel (€/km)</p>
      <div style={grid3}>
        <div>
          <label style={label}>Jusqu&apos;à 5 000 km</label>
          <input name={`${prefix}_t1`} defaultValue={taux(b, 0)} type="number" step="0.001" style={field} />
        </div>
        <div>
          <label style={label}>De 5 001 à 20 000 km</label>
          <input name={`${prefix}_t2`} defaultValue={taux(b, 1)} type="number" step="0.001" style={field} />
        </div>
        <div>
          <label style={label}>Au-delà de 20 000 km</label>
          <input name={`${prefix}_t3`} defaultValue={taux(b, 2)} type="number" step="0.001" style={field} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: "0 0 14px" }}>Réglages</h1>

      {sp.saved && (
        <div style={{ background: "#e6f7ec", border: "1px solid #b7e4c7", color: "#1d6f42", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 14 }}>
          ✓ Vos réglages ont bien été enregistrés.
        </div>
      )}

      <form action={enregistrerReglages}>
        <div style={card}>
          <h2 style={cardTitle}>Mes informations</h2>
          <p style={{ fontSize: 13, color: "#7F7F7F", margin: "-8px 0 16px" }}>
            Apparaissent en en-tête des documents générés (note de frais, etc.).
          </p>
          <div style={{ ...grid2, marginBottom: 14 }}>
            <Field name="nomConsultant" lbl="Bénéficiaire (nom complet)" def={s?.nomConsultant} ph="Frédéric WOEHREL" />
            <Field name="titreConsultant" lbl="Titre / fonction" def={s?.titreConsultant} ph="Consultant" />
          </div>
          <Field name="adresseDomicile" lbl="Adresse" def={s?.adresseDomicile} ph="59 Grand Rue, 67350 Niedermodern" />
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Coordonnées bancaires</h2>
          <p style={{ fontSize: 13, color: "#7F7F7F", margin: "-8px 0 16px" }}>
            Utilisées pour le remboursement en pied de note de frais.
          </p>
          <div style={{ marginBottom: 14 }}>
            <Field name="titulaireCompte" lbl="Titulaire du compte" def={s?.titulaireCompte} ph="ex. Frédéric WOEHREL / Ethik & Co" />
          </div>
          <div style={grid2}>
            <Field name="iban" lbl="IBAN" def={s?.iban} ph="FR76 ..." />
            <Field name="bic" lbl="BIC" def={s?.bic} ph="ex. CMCIFR2A" />
          </div>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Paramètres de calcul</h2>
          <div style={grid2}>
            <div>
              <label style={label}>Durée indicative d&apos;une journée (heures)</label>
              <input name="dureeJourneeH" defaultValue={(s?.dureeJourneeH ?? 7).toString()} type="number" step="0.5" style={field} />
              <p style={hint}>Repère indicatif (le décompte des jours suit la règle des demi-journées ci-dessous).</p>
            </div>
            <div>
              <label style={label}>Seuil d&apos;alerte (jours)</label>
              <input name="seuilAlerteJours" defaultValue={(s?.seuilAlerteJours ?? 7).toString()} type="number" step="1" style={field} />
              <p style={hint}>Déclenche une alerte sur le tableau de bord.</p>
            </div>
          </div>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Calcul des demi-journées travaillées</h2>
          <p style={{ fontSize: 13, color: "#7F7F7F", margin: "-8px 0 16px" }}>
            Règle d&apos;estimation des jours travaillés affichée dans le rapport mensuel. <strong>Indicateur strictement interne</strong>, destiné à vous guider pour la facturation — il n&apos;est jamais communiqué au client.
          </p>
          <ReglesDemiJournee
            matinFin={s?.demiJMatinFinMin ?? REGLE_DEMI_J_DEFAUT.matinFinMin}
            apremDebut={s?.demiJApremDebutMin ?? REGLE_DEMI_J_DEFAUT.apremDebutMin}
            seuil={s?.demiJSeuilMin ?? REGLE_DEMI_J_DEFAUT.seuilMin}
          />
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Barèmes kilométriques URSSAF</h2>
          <p style={{ fontSize: 13, color: "#7F7F7F", margin: "-8px 0 16px" }}>
            Taux appliqués au calcul des indemnités. À mettre à jour chaque année selon le barème officiel URSSAF.
          </p>
          <BaremeBloc prefix="ariya" b={ariya} nomFixe="Nissan Ariya (100 % électrique)" />
          <BaremeBloc prefix="sharan" b={sharan} nomFixe="VW Sharan (Diesel)" />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" style={{ fontSize: 15, fontWeight: 600, padding: "11px 22px", borderRadius: 8, background: "#00B0F0", color: "#fff", border: "none", cursor: "pointer" }}>
            Enregistrer les réglages
          </button>
        </div>
      </form>
    </>
  );
}
