import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

// Accessible sans authentification (connexion + fichiers PWA)
const PUBLIC_PATHS = [
  "/login",
  "/api/login",
  "/manifest.json",
  "/icon.svg",
  "/favicon.ico",
];

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  // Pas de mot de passe configuré → application ouverte (dev local, démo)
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await authToken(password)))
    return NextResponse.next();

  if (pathname.startsWith("/api/"))
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Tout sauf les ressources statiques de Next
  matcher: ["/((?!_next/static|_next/image).*)"],
};
