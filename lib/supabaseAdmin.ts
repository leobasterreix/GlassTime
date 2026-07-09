import { createClient } from "@supabase/supabase-js";

// Client Supabase service-role — contourne les RLS et le trigger
// protect_subscription_columns (voir supabase/migrations/20260709_subscription_plan.sql).
// Réservé au code serveur qui n'a pas de session utilisateur à faire valoir :
// le webhook Lemon Squeezy et les routes /api/admin/*. Ne jamais exposer
// cette clé côté client (pas de préfixe NEXT_PUBLIC_).
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}
