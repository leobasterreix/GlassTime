import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Suspension quasi permanente (~100 ans) mais réversible via l'action "unban" —
// Supabase GoTrue n'a pas de notion de bannissement infini, juste une durée.
const BAN_DURATION = "876000h";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const [{ data: authUser, error: authError }, { data: profile }, { data: events }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(id),
    supabaseAdmin.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabaseAdmin
      .from("subscription_events")
      .select("id, event_type, created_at, payload")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (authError || !authUser?.user) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }

  const banned = !!authUser.user.banned_until && new Date(authUser.user.banned_until).getTime() > Date.now();

  return NextResponse.json({
    id: authUser.user.id,
    email: authUser.user.email ?? "",
    createdAt: authUser.user.created_at,
    lastSignInAt: authUser.user.last_sign_in_at ?? null,
    banned,
    profile: profile ?? null,
    events: events ?? [],
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const { action } = await req.json();

  if (action === "toggle_premium") {
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("subscription_plan")
      .eq("id", id)
      .maybeSingle();
    if (fetchError || !profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }
    const next = profile.subscription_plan === "premium" ? "free" : "premium";
    const { error } = await supabaseAdmin.from("profiles").update({ subscription_plan: next }).eq("id", id);
    if (error) {
      console.error("Erreur toggle_premium admin:", error);
      return NextResponse.json({ error: "Erreur de mise à jour" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, subscriptionPlan: next });
  }

  if (action === "ban" || action === "unban") {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: action === "ban" ? BAN_DURATION : "none",
    });
    if (error) {
      console.error("Erreur ban/unban admin:", error);
      return NextResponse.json({ error: "Erreur de mise à jour" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, banned: action === "ban" });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  // La table follows n'a pas de cascade de suppression garantie (schéma non
  // versionné) — nettoyage manuel avant de couper le compte auth (profiles
  // et subscription_events suivent via leurs FK "on delete cascade").
  await supabaseAdmin.from("follows").delete().or(`follower_id.eq.${id},followed_id.eq.${id}`);
  await supabaseAdmin.from("profiles").delete().eq("id", id);

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) {
    console.error("Erreur suppression compte admin:", error);
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
