"use client";

import { useEffect } from "react";
import { useTrack } from "@/lib/store";
import { supabase } from "@/lib/supabaseClient";

// Synchronisation multi-appareils via Supabase.
// Au chargement/connexion : le plus récent (local ou serveur) gagne, d'après updatedAt.
// Ensuite : chaque modification locale est poussée après 1,5 s d'inactivité.

const SYNC_KEYS = [
  "followed",
  "watched",
  "movieWatchlist",
  "moviesWatched",
  "booksWatchlist",
  "booksRead",
  "showCache",
  "movieCache",
  "bookCache",
  "booksProgress",
  "updatedAt",
] as const;

type SyncState = Record<string, unknown> & { updatedAt?: number };

function snapshot(): SyncState {
  const st = useTrack.getState() as unknown as Record<string, unknown>;
  return Object.fromEntries(SYNC_KEYS.map((k) => [k, st[k]]));
}

export default function SyncManager() {
  const theme = useTrack((st) => st.theme);

  useEffect(() => {
    function applyTheme() {
      let resolved: "light" | "dark" = "dark";
      if (theme === "system") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        resolved = theme;
      }
      document.documentElement.setAttribute("data-theme", resolved);
    }

    applyTheme();

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme();
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [theme]);

  useEffect(() => {
    useTrack.getState().migrateDemoIds();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubStore = () => {};
    let applying = false;

    async function pushState(userId: string) {
      try {
        const state = snapshot();
        await supabase.from("user_states").upsert({
          user_id: userId,
          state,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Erreur de sauvegarde Supabase :", err);
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        unsubStore();
        clearTimeout(timer);

        if (session?.user) {
          const userId = session.user.id;

          try {
            const { data, error } = await supabase
              .from("user_states")
              .select("state")
              .eq("user_id", userId)
              .maybeSingle();

            if (error) throw error;

            const server: SyncState | null = (data?.state as SyncState) || null;
            const localUpdated = useTrack.getState().updatedAt ?? 0;
            const serverUpdated = server?.updatedAt ?? 0;

            if (server && serverUpdated > localUpdated) {
              applying = true;
              useTrack.setState(server);
              applying = false;
            } else if (localUpdated > serverUpdated) {
              void pushState(userId);
            }

            // S'abonner aux changements du store local
            unsubStore = useTrack.subscribe(() => {
              if (applying) return;
              clearTimeout(timer);
              timer = setTimeout(() => pushState(userId), 1500);
            });
          } catch (err) {
            console.error("Erreur de réconciliation initiale :", err);
          }
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
      unsubStore();
      clearTimeout(timer);
    };
  }, []);

  return null;
}
