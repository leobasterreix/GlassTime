import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages accessibles sans être connecté (connexion, auth callback, fichiers PWA)
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/manifest.json",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

export async function middleware(request: NextRequest) {
  // Garde-fou anti-verrouillage : tant que les vraies clés Supabase ne sont pas
  // configurées, on laisse l'application ouverte (pas d'authentification).
  // L'auth s'active donc automatiquement dès qu'on renseigne
  // NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (local + Vercel).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next();

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const rememberMe = request.cookies.get("remember_me")?.value !== "false";

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            const finalOptions = { ...options };
            if (!rememberMe) {
              delete finalOptions.maxAge;
              delete finalOptions.expires;
            }
            response.cookies.set(name, value, finalOptions);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  // Rediriger vers l'accueil si l'utilisateur est connecté et essaie d'aller sur /login
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Rediriger vers /login si l'utilisateur n'est pas connecté et accède à une page privée
  if (!user && !isPublicPath) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
