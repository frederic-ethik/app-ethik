import { prisma } from "@/lib/prisma";
import SaisieForm from "@/components/SaisieForm";

export const dynamic = "force-dynamic";

export default async function SaisiePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; mode?: string; date?: string; debut?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const [clients, types] = await Promise.all([
    prisma.client.findMany({
      where: { actif: true },
      orderBy: { raisonSociale: "asc" },
      select: { id: true, raisonSociale: true },
    }),
    prisma.missionType.findMany({
      where: { actif: true },
      orderBy: [{ categorie: "asc" }, { objet: "asc" }],
      select: { id: true, clientId: true, categorie: true, objet: true, detail: true },
    }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const initialMode = sp.mode === "badgeage" ? "badgeage" : "rattrapage";

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: "#595959", margin: "0 0 4px" }}>Saisie d&apos;une activité</h1>
      <p style={{ fontSize: 13, color: "#7F7F7F", margin: "0 0 22px" }}>
        Démarrez un chrono (badgeage) ou saisissez une activité passée (rattrapage).
      </p>

      {sp.ok && (
        <div style={{ background: "#eef7e1", color: "#5f8e2a", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 18, maxWidth: 520 }}>
          ✓ Activité enregistrée. Vous pouvez saisir la suivante (client et heure de début pré-remplis).
        </div>
      )}

      <div style={{ maxWidth: 520, background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, padding: "20px 22px" }}>
        <SaisieForm
          clients={clients}
          types={types}
          today={today}
          initialClientId={sp.client ?? ""}
          initialMode={initialMode}
          initialDate={sp.date ?? ""}
          initialDebut={sp.debut ?? ""}
        />
      </div>
    </>
  );
}
