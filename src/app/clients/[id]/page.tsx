import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { enregistrerClient, enregistrerMissionType, basculerMissionType } from "@/app/actions";

export const dynamic = "force-dynamic";

const TYPE_CLIENT_OPTS: [string, string][] = [
  ["ESS_ASSO", "ESS · Association"],
  ["ESS_SCOOP", "ESS · SCOP"],
  ["SECTEUR_MARCHAND", "Secteur marchand"],
  ["NON_FACTURABLE", "Non facturable"],
  ["NON_FACTURE", "Non facturé"],
];
const TYPE_FACT_OPTS: [string, string][] = [
  ["HORAIRE", "Horaire"],
  ["REFACTURATION_REEL", "Refacturation au réel"],
  ["NON_FACTURE", "Non facturé"],
];

export default async function FicheClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "nouveau";

  const client = isNew
    ? null
    : await prisma.client.findUnique({
        where: { id },
        include: { missionTypes: { orderBy: [{ actif: "desc" }, { categorie: "asc" }, { objet: "asc" }] } },
      });
  if (!isNew && !client) notFound();

  const card = { background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "20px 22px", marginBottom: 20 } as const;
  const cardTitle = { fontSize: 15, fontWeight: 600, color: "#0077a8", margin: "0 0 14px" } as const;
  const label = { fontSize: 12, color: "#7F7F7F", display: "block", marginBottom: 4 } as const;
  const field = { fontSize: 14, padding: "9px 11px", border: "1px solid rgba(0,0,0,.2)", borderRadius: 8, background: "#fff", color: "#595959", width: "100%", boxSizing: "border-box" } as const;
  const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } as const;
  const grid3 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 } as const;

  const Field = ({ name, lbl, def, ph, type = "text" }: { name: string; lbl: string; def?: string | null; ph?: string; type?: string }) => (
    <div>
      <label style={label}>{lbl}</label>
      <input name={name} defaultValue={def ?? ""} placeholder={ph} type={type} style={field} />
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Link href="/clients" style={{ fontSize: 13, color: "#7F7F7F", textDecoration: "none" }}>← Clients</Link>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: 0 }}>
          {isNew ? "Nouveau client" : client!.raisonSociale}
        </h1>
      </div>

      {sp.saved && (
        <div style={{ background: "#e6f7ec", border: "1px solid #b7e4c7", color: "#1d6f42", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 14 }}>
          ✓ Enregistré.
        </div>
      )}

      {/* ===== Fiche client ===== */}
      <form action={enregistrerClient}>
        <input type="hidden" name="id" value={id} />
        <div style={card}>
          <h2 style={cardTitle}>Identité</h2>
          <div style={{ ...grid2, marginBottom: 14 }}>
            <Field name="raisonSociale" lbl="Raison sociale *" def={client?.raisonSociale} ph="ex. ML Terres de Lorraine" />
            <Field name="siret" lbl="SIRET" def={client?.siret} ph="14 chiffres" />
          </div>
          <div style={grid2}>
            <div>
              <label style={label}>Type de client</label>
              <select name="typeClient" defaultValue={client?.typeClient ?? "NON_FACTURE"} style={field}>
                {TYPE_CLIENT_OPTS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Cible de jours / mois</label>
              <input name="cibleJoursMensuelle" defaultValue={client?.cibleJoursMensuelle?.toString() ?? ""} placeholder="ex. 4" type="number" step="0.5" style={field} />
            </div>
          </div>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Adresse</h2>
          <div style={{ marginBottom: 14 }}>
            <Field name="adresse" lbl="Adresse" def={client?.adresse} ph="N° et rue" />
          </div>
          <div style={grid2}>
            <Field name="codePostal" lbl="Code postal" def={client?.codePostal} />
            <Field name="ville" lbl="Ville" def={client?.ville} />
          </div>
        </div>

        <div style={card}>
          <h2 style={cardTitle}>Contact</h2>
          <div style={{ ...grid3, marginBottom: 14 }}>
            <Field name="contactNom" lbl="Nom" def={client?.contactNom} />
            <Field name="contactPrenom" lbl="Prénom" def={client?.contactPrenom} />
            <Field name="contactTitre" lbl="Titre / fonction" def={client?.contactTitre} />
          </div>
          <div style={grid2}>
            <Field name="contactEmail" lbl="Email" def={client?.contactEmail} type="email" />
            <Field name="contactTelephone" lbl="Téléphone" def={client?.contactTelephone} />
          </div>
        </div>

        <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#595959" }}>
              <input type="checkbox" name="actif" defaultChecked={isNew ? true : client!.actif} style={{ width: 16, height: 16 }} />
              Client actif (décochez pour l&apos;archiver)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#595959" }}>
              <input type="checkbox" name="estStructure" defaultChecked={isNew ? false : client!.estStructure} style={{ width: 16, height: 16 }} />
              Ma structure (E&amp;C) — heures de fonctionnement, non facturables
            </label>
          </div>
          <button type="submit" style={{ fontSize: 15, fontWeight: 600, padding: "11px 22px", borderRadius: 8, background: "#00B0F0", color: "#fff", border: "none", cursor: "pointer" }}>
            {isNew ? "Créer le client" : "Enregistrer"}
          </button>
        </div>
      </form>

      {/* ===== Types de missions ===== */}
      {isNew ? (
        <div style={{ ...card, color: "#a5a5a5", fontSize: 14 }}>
          Enregistrez d&apos;abord le client pour pouvoir ajouter ses types de missions.
        </div>
      ) : (
        <div style={card}>
          <h2 style={cardTitle}>Types de missions ({client!.missionTypes.length})</h2>
          <p style={{ fontSize: 13, color: "#7F7F7F", margin: "-8px 0 16px" }}>
            Catégorie › Objet › Détail. Les types liés à des activités ne sont jamais supprimés, seulement archivés.
          </p>

          {/* En-têtes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 150px 170px", gap: 10, fontSize: 11, color: "#7F7F7F", fontWeight: 600, padding: "0 2px 6px" }}>
            <div>Catégorie</div><div>Objet</div><div>Détail</div><div>Facturation</div><div></div>
          </div>

          {client!.missionTypes.map((m) => (
            <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, opacity: m.actif ? 1 : 0.5 }}>
              <form action={enregistrerMissionType} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 150px 90px", gap: 10, flex: 1, alignItems: "center" }}>
                <input type="hidden" name="clientId" value={id} />
                <input type="hidden" name="mid" value={m.id} />
                <input name="categorie" defaultValue={m.categorie} style={{ ...field, padding: "7px 9px" }} />
                <input name="objet" defaultValue={m.objet} style={{ ...field, padding: "7px 9px" }} />
                <input name="detail" defaultValue={m.detail ?? ""} placeholder="—" style={{ ...field, padding: "7px 9px" }} />
                <select name="typeFacturation" defaultValue={m.typeFacturation} style={{ ...field, padding: "7px 9px" }}>
                  {TYPE_FACT_OPTS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <button type="submit" style={{ fontSize: 13, fontWeight: 600, padding: "7px 8px", borderRadius: 8, background: "#eef7ff", color: "#0077a8", border: "1px solid #cfe8fb", cursor: "pointer" }}>
                  💾
                </button>
              </form>
              <form action={basculerMissionType}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="clientId" value={id} />
                <button type="submit" style={{ fontSize: 12, fontWeight: 600, padding: "7px 8px", borderRadius: 8, background: "none", color: m.actif ? "#b06a00" : "#1d6f42", border: "none", cursor: "pointer", width: 72 }}>
                  {m.actif ? "Archiver" : "Réactiver"}
                </button>
              </form>
            </div>
          ))}

          {/* Ajout d'un nouveau type */}
          <form action={enregistrerMissionType} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 150px 170px", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px dashed rgba(0,0,0,.15)", alignItems: "center" }}>
            <input type="hidden" name="clientId" value={id} />
            <input name="categorie" placeholder="Catégorie *" required style={{ ...field, padding: "7px 9px" }} />
            <input name="objet" placeholder="Objet *" required style={{ ...field, padding: "7px 9px" }} />
            <input name="detail" placeholder="Détail (facultatif)" style={{ ...field, padding: "7px 9px" }} />
            <select name="typeFacturation" defaultValue="NON_FACTURE" style={{ ...field, padding: "7px 9px" }}>
              {TYPE_FACT_OPTS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <button type="submit" style={{ fontSize: 13, fontWeight: 600, padding: "8px 10px", borderRadius: 8, background: "#92D050", color: "#fff", border: "none", cursor: "pointer" }}>
              + Ajouter
            </button>
          </form>
        </div>
      )}
    </>
  );
}
