import { createClient } from "@supabase/supabase-js";

// Fallback sur des valeurs bidons pendant le build Vercel si les variables ne sont pas encore configurées
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";

/**
 * Vrai uniquement si de vraies clés Supabase sont configurées.
 * Garde-fou : tant que Supabase n'est pas branché, l'application reste
 * ouverte (pas d'authentification) au lieu de verrouiller tout le monde dehors.
 */
export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
