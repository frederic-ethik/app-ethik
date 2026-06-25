"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createActivite, startBadgeage, updateActivite, finaliserActivite } from "@/app/actions";
import { dureeHeures, formatHeures } from "@/lib/format";

type Client = { id: string; raisonSociale: string; actif?: boolean };
type Type = { id: string; clientId: string; categorie: string; objet: string; detail: string | null };
type Edit = {
  id: string;
  clientId: string;
  missionTypeId: string;
  dateAct: string;
  debut: string;
  fin: string;
  commentaire: string;
  hasDeplacement: boolean;
  aDesFrais?: boolean;
  fraisLabel?: string;
};

export default function SaisieForm({
  clients,
  types,
  today,
  initialClientId = "",
  initialMode = "rattrapage",
  initialDate = "",
  initialDebut = "",
  edit,
  finalize = false,
  nextClientId = "",
  submitLabel,
}: {
  clients: Client[];
  types: Type[];
  today: string;
  initialClientId?: string;
  initialMode?: "badgeage" | "rattrapage";
  initialDate?: string;
  initialDebut?: string;
  edit?: Edit;
  finalize?: boolean;
  nextClientId?: string;
  submitLabel?: string;
}) {
  const isEdit = !!edit;
  const [mode, setMode] = useState<"badgeage" | "rattrapage">(isEdit ? "rattrapage" : initialMode);
  const [clientId, setClientId] = useState(edit?.clientId ?? initialClientId);
  const [missionTypeId, setMissionTypeId] = useState(edit?.missionTypeId ?? "");
  const [debut, setDebut] = useState(edit?.debut || initialDebut || "09:00");
  const [fin, setFin] = useState(edit?.fin || initialDebut || "10:00");
  const [marqueDepl, setMarqueDepl] = useState(edit?.hasDeplacement ?? false);
  const formRef = useRef<HTMLFormElement>(null);
  const started = useRef(false);

  const badgeage = !isEdit && mode === "badgeage";

  // Le chrono démarre dès qu'un client est connu (sélection ou pré-remplissage via "Changer")
  useEffect(() => {
    if (badgeage && clientId && !started.current) {
      started.current = true;
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    }
  }, [badgeage, clientId]);

  const typesClient = useMemo(() => types.filter((t) => t.clientId === clientId), [types, clientId]);
  const detail = useMemo(() => types.find((t) => t.id === missionTypeId)?.detail ?? null, [types, missionTypeId]);
  const duree = dureeHeures(debut, fin);

  const action = !isEdit
    ? badgeage
      ? startBadgeage
      : createActivite
    : finalize
    ? finaliserActivite
    : updateActivite;

  const defaultLabel = badgeage
    ? "Démarrer le chrono"
    : finalize
    ? "Terminer et enregistrer"
    : isEdit
    ? "Mettre à jour l'activité"
    : "Enregistrer l'activité";

  const label = { fontSize: 12, color: "#7F7F7F", marginBottom: 3, display: "block" } as const;
  const field = {
    width: "100%",
    fontSize: 14,
    padding: "9px 10px",
    border: "1px solid rgba(0,0,0,.2)",
    borderRadius: 8,
    background: "#fff",
    color: "#595959",
    boxSizing: "border-box" as const,
  };
  const primaryBtn = {
    width: "100%",
    padding: "12px",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(90deg,#92D050,#7cbf3f)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  } as const;
  const secondaryBtn = {
    width: "100%",
    padding: "11px",
    borderRadius: 8,
    border: "1px solid #92D050",
    background: "#fff",
    color: "#5f8e2a",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  } as const;

  return (
    <form ref={formRef} action={action}>
      {isEdit && <input type="hidden" name="id" value={edit!.id} />}
      {nextClientId && <input type="hidden" name="next" value={nextClientId} />}

      {!isEdit && (
        <div style={{ display: "flex", gap: 6, background: "#f2f4f5", padding: 4, borderRadius: 8, marginBottom: 18 }}>
          {(["badgeage", "rattrapage"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                fontSize: 13,
                padding: "8px",
                borderRadius: 6,
                border: mode === m ? "1px solid rgba(0,0,0,.1)" : "1px solid transparent",
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? "#595959" : "#7F7F7F",
                cursor: "pointer",
                fontWeight: mode === m ? 600 : 400,
              }}
            >
              {m === "badgeage" ? "Badgeage (chrono)" : "Rattrapage (saisie manuelle)"}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={label}>Client</label>
        <select
          name="clientId"
          required
          value={clientId}
          onChange={(e) => {
            const v = e.target.value;
            setClientId(v);
            setMissionTypeId("");
            if (badgeage && v && !started.current) {
              started.current = true;
              requestAnimationFrame(() => formRef.current?.requestSubmit());
            }
          }}
          style={field}
        >
          <option value="">— Choisir un client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.raisonSociale}{c.actif === false ? " (archivé)" : ""}
            </option>
          ))}
        </select>
      </div>

      {badgeage ? (
        <>
          <p style={{ fontSize: 13, color: "#7F7F7F", margin: "0 0 16px" }}>
            Le chrono démarre <b>dès que vous choisissez le client</b>. Vous préciserez le type de mission et le commentaire au moment de terminer.
          </p>
          <button type="submit" style={primaryBtn}>{submitLabel ?? defaultLabel}</button>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Type de mission</label>
            <select
              name="missionTypeId"
              value={missionTypeId}
              onChange={(e) => setMissionTypeId(e.target.value)}
              disabled={!clientId}
              style={{ ...field, opacity: clientId ? 1 : 0.6 }}
            >
              <option value="">{clientId ? "— Choisir un type —" : "Choisissez d'abord un client"}</option>
              {typesClient.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.categorie} › {t.objet}
                </option>
              ))}
            </select>
          </div>

          {detail && (
            <div style={{ background: "#f2f4f5", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#7F7F7F", marginBottom: 12 }}>
              <b style={{ color: "#595959" }}>Détail :</b> {detail}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={label}>Date</label>
            <input type="date" name="date" defaultValue={edit?.dateAct ?? (initialDate || today)} required style={field} />
          </div>

          {finalize ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>Début</label>
                <input type="time" name="debut" value={debut} onChange={(e) => setDebut(e.target.value)} required style={field} />
              </div>
              <div style={{ background: "#eef7e1", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#5f8e2a", marginBottom: 12 }}>
                ⏱ Le chrono tourne toujours — l&apos;heure de fin sera enregistrée <b>à la validation</b>.
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Début</label>
                  <input type="time" name="debut" value={debut} onChange={(e) => setDebut(e.target.value)} required style={field} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Fin</label>
                  <input type="time" name="fin" value={fin} onChange={(e) => setFin(e.target.value)} required style={field} />
                </div>
              </div>
              <div style={{ background: "#e0f5fe", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#0077a8", marginBottom: 12 }}>
                Durée : {formatHeures(duree)}
              </div>
            </>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={label}>Commentaire</label>
            <textarea name="commentaire" rows={2} defaultValue={edit?.commentaire ?? ""} placeholder="Décrivez ce que vous avez fait…" style={{ ...field, resize: "vertical" }} />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#595959", background: "#f2f4f5", borderRadius: 8, padding: "10px 12px", marginBottom: edit?.aDesFrais && !marqueDepl ? 8 : 16, cursor: "pointer" }}>
            <input
              type="checkbox"
              name="hasDeplacement"
              checked={marqueDepl}
              onChange={(e) => {
                const coche = e.target.checked;
                if (!coche && edit?.aDesFrais) {
                  const ok = window.confirm(
                    `Cette activité a des frais de déplacement enregistrés (${edit.fraisLabel}).\n\n` +
                      `En décochant cette case puis en enregistrant, ces frais seront définitivement supprimés.\n\nVoulez-vous continuer ?`
                  );
                  if (!ok) return; // on garde la case cochée
                }
                setMarqueDepl(coche);
              }}
              style={{ width: 16, height: 16 }}
            />
            <span>🚗 Frais de déplacement à saisir <span style={{ color: "#7F7F7F" }}>(la voiture apparaîtra dans le journal pour compléter les frais plus tard)</span></span>
          </label>
          {edit?.aDesFrais && !marqueDepl && (
            <div style={{ fontSize: 12.5, color: "#b06a00", background: "#fff6e0", border: "1px solid #f0d9a0", borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
              ⚠ Des frais sont enregistrés ({edit.fraisLabel}). En l&apos;état, ils seront <b>supprimés</b> à l&apos;enregistrement. Recochez la case pour les conserver.
            </div>
          )}

          <button type="submit" style={primaryBtn}>{submitLabel ?? defaultLabel}</button>
          {!isEdit && (
            <button type="submit" name="suivant" value="1" style={secondaryBtn}>
              Enregistrer et saisir la suivante ↵
            </button>
          )}
        </>
      )}
    </form>
  );
}
