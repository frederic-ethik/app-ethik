import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifierJeton, COOKIE_SESSION } from "@/lib/auth";

// Routes publiques : login + accès client (lecture seule par jeton) + manifeste PWA
// (le manifeste doit être lisible sans connexion, sinon le navigateur ne trouve pas l'icône d'installation)
const PUBLIQUES = ["/login", "/acces", "/manifest.webmanifest"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIQUES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_SESSION)?.value;
  const session = token ? await verifierJeton(token) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// On exécute le middleware partout sauf les fichiers statiques
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.png$).*)"],
};
