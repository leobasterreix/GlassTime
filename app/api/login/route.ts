import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, authToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password)
    return NextResponse.json({ ok: true, open: true });

  const body = await req.json().catch(() => ({}));
  if (typeof body.password !== "string" || body.password !== password)
    return NextResponse.json(
      { error: "Mot de passe incorrect" },
      { status: 401 }
    );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await authToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}

/** Verrouillage manuel : supprime le cookie de session. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
