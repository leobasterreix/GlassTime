import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Reçoit les événements d'abonnement de Lemon Squeezy (subscription_created,
// subscription_updated, subscription_cancelled, subscription_expired,
// subscription_resumed) et met à jour le statut Premium du profil Supabase
// correspondant. À configurer dans le dashboard Lemon Squeezy : Settings →
// Webhooks → URL = https://<domaine>/api/lemonsqueezy/webhook.
export async function POST(req: Request) {
  const rawBody = await req.text(); // brut, requis pour le calcul du HMAC — ne pas appeler req.json() avant
  const signature = req.headers.get("x-signature") ?? "";
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    console.error("LEMONSQUEEZY_WEBHOOK_SECRET non configuré");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const digestBuf = Buffer.from(digest);
  const signatureBuf = Buffer.from(signature);
  const valid =
    digestBuf.length === signatureBuf.length &&
    crypto.timingSafeEqual(digestBuf, signatureBuf);

  if (!valid) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventName: string = payload.meta?.event_name ?? "";
  const userId: string | undefined = payload.meta?.custom_data?.user_id;
  const sub = payload.data?.attributes;

  if (!userId) {
    // Pas de custom_data.user_id : impossible de relier ce paiement à un
    // compte Supabase (le lien de checkout ne l'a probablement pas transmis).
    // On accuse quand même réception (200) sinon Lemon Squeezy retente indéfiniment.
    console.error("Webhook Lemon Squeezy sans custom_data.user_id", eventName);
    return NextResponse.json({ ok: true });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error("Supabase non configuré côté serveur pour le webhook Lemon Squeezy");
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  const isActive = ["on_trial", "active"].includes(sub?.status);

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_plan: isActive ? "premium" : "free",
      subscription_status: sub?.status ?? null,
      lemonsqueezy_customer_id: sub?.customer_id != null ? String(sub.customer_id) : null,
      lemonsqueezy_subscription_id: payload.data?.id != null ? String(payload.data.id) : null,
      subscription_renews_at: sub?.renews_at ?? null,
      subscription_ends_at: sub?.ends_at ?? null,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Erreur mise à jour profil Lemon Squeezy:", updateError);
  }

  await supabaseAdmin.from("subscription_events").insert({
    user_id: userId,
    event_type: eventName,
    payload,
  });

  return NextResponse.json({ ok: true });
}
