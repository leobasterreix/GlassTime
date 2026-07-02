import { createClient } from "@supabase/supabase-js";

// Fallback sur des valeurs bidons pendant le build Vercel si les variables ne sont pas encore configurées
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
