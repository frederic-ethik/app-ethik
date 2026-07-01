import { Resend } from "resend";
import { MOIS } from "@/lib/format";

const EMAIL_TO = process.env.NOTIF_EMAIL_TO ?? "frederic@ethik-et-co.alsace";
const EMAIL_FROM = process.env.NOTIF_EMAIL_FROM ?? "Ethik & Co <notifications@ethik-et-co.alsace>";

function moisLabel(mk: string | null): string {
  if (!mk) return "";
  const [y, m] = mk.split("-").map(Number);
  return `${MOIS[m - 1]} ${y}`;
}

// Notifie le consultant qu'un client vient de consulter son rapport en ligne.
// Silencieux si RESEND_API_KEY est absent ; n'échoue jamais bruyamment (à appeler
// via after() pour ne pas ralentir la page cliente).
export async function notifierConsultation(raisonSociale: string, moisVu: string | null): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // pas de clé configurée → on n'envoie rien

  const quand = new Date().toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(":", "h");
  const mois = moisLabel(moisVu);

  try {
    const resend = new Resend(key);
    await resend.emails.send({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `👀 ${raisonSociale} a consulté son rapport en ligne`,
      text:
        `${raisonSociale} vient d'ouvrir son espace de consultation.\n` +
        (mois ? `Rapport consulté : ${mois}.\n` : "") +
        `Le ${quand}.\n\n` +
        `— Notification automatique Ethik & Co`,
      html:
        `<div style="font-family:Arial,Helvetica,sans-serif;color:#595959;font-size:14px;line-height:1.5">` +
        `<p><strong style="color:#0077a8">${raisonSociale}</strong> vient d'ouvrir son espace de consultation.</p>` +
        (mois ? `<p>Rapport consulté : <strong>${mois}</strong></p>` : "") +
        `<p style="color:#7F7F7F">Le ${quand}</p>` +
        `<p style="color:#a5a5a5;font-size:12px;margin-top:18px">Notification automatique — Ethik &amp; Co</p>` +
        `</div>`,
    });
  } catch {
    /* l'envoi ne doit jamais casser la consultation client */
  }
}
