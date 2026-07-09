// Accès à l'espace admin (/admin) — restreint par email, jamais par un rôle
// stocké côté client. ADMIN_EMAILS n'est lu que côté serveur (middleware,
// routes API), jamais exposé au navigateur (pas de préfixe NEXT_PUBLIC_).
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
