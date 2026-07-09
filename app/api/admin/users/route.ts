import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const DAY_MS = 24 * 60 * 60 * 1000;

// Liste + recherche des comptes pour le back-office (protégé par middleware.ts
// via ADMIN_EMAILS). `auth.users` (via l'API admin) reste la source de vérité
// pour l'identité/la date d'inscription — `profiles` n'a pas de colonne
// created_at et n'est utile ici que pour le statut d'abonnement.
export async function GET(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";

  // 200 comptes en un seul appel : largement suffisant à l'échelle actuelle,
  // pas de pagination pour l'instant (limite à revoir si le nombre de comptes
  // grossit significativement).
  const { data: authList, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (authError) {
    console.error("Erreur listUsers admin:", authError);
    return NextResponse.json({ error: "Erreur de chargement des comptes" }, { status: 500 });
  }

  const ids = authList.users.map((u) => u.id);
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, subscription_plan")
    .in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (profilesError) {
    console.error("Erreur chargement profiles admin:", profilesError);
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const now = Date.now();
  const users = authList.users.map((u) => {
    const profile = profileById.get(u.id);
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    return {
      id: u.id,
      email: u.email ?? "",
      name,
      avatarUrl: profile?.avatar_url ?? null,
      subscriptionPlan: profile?.subscription_plan === "premium" ? "premium" : "free",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      banned: !!u.banned_until && new Date(u.banned_until).getTime() > now,
    };
  });

  const stats = {
    total: users.length,
    premium: users.filter((u) => u.subscriptionPlan === "premium").length,
    signups30d: users.filter((u) => now - new Date(u.createdAt).getTime() <= 30 * DAY_MS).length,
  };

  const filtered = q
    ? users.filter((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
    : users;

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ stats, users: filtered });
}
