import { SignJWT, jwtVerify } from "jose";

// Nom du cookie de session et clé de signature (depuis .env)
export const COOKIE_SESSION = "ethik_session";
const cle = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

export type Session = { sub: string; email: string };

// Crée un jeton de session signé (valide 30 jours)
export async function creerJeton(payload: Session): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(cle());
}

// Vérifie un jeton ; renvoie la session ou null si invalide/expiré
export async function verifierJeton(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, cle());
    return { sub: String(payload.sub), email: String(payload.email) };
  } catch {
    return null;
  }
}
