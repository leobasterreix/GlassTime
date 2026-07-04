"use client";

import { useEffect } from "react";
import { useTrack } from "@/lib/store";
import { applyAccent } from "@/lib/accent";
import { supabase } from "@/lib/supabaseClient";

// Synchronisation multi-appareils via Supabase.
// Au chargement/connexion : le plus récent (local ou serveur) gagne, d'après updatedAt.
// Ensuite : chaque modification locale est poussée après 1,5 s d'inactivité.

const SYNC_KEYS = [
  "followed",
  "watched",
  "movieWatchlist",
  "moviesWatched",
  "moviesWatchedDates",
  "booksWatchlist",
  "booksRead",
  "booksReadDates",
  "showCache",
  "movieCache",
  "bookCache",
  "showStatus",
  "watchedLog",
  "accent",
  "favoriteShows",
  "favoriteMovies",
  "favoriteBooks",
  "myPlatforms",
  "notifications",
  "updatedAt",
] as const;

type SyncState = Record<string, unknown> & { updatedAt?: number };

function snapshot(): SyncState {
  const st = useTrack.getState() as unknown as Record<string, unknown>;
  return Object.fromEntries(SYNC_KEYS.map((k) => [k, st[k]]));
}

export default function SyncManager() {
  const theme = useTrack((st) => st.theme);
  const accent = useTrack((st) => st.accent);

  useEffect(() => {
    // Applique le thème (clair/sombre) puis la couleur d'accent : l'accent
    // doit être ré-appliqué à chaque bascule car sa version « encre » (texte)
    // dépend du thème.
    function applyThemeAndAccent() {
      let resolved: "light" | "dark" = "dark";
      if (theme === "system") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        resolved = theme;
      }
      document.documentElement.setAttribute("data-theme", resolved);
      applyAccent(accent, resolved);
    }

    applyThemeAndAccent();

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyThemeAndAccent();
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [theme, accent]);

  useEffect(() => {
    useTrack.getState().migrateDemoIds();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubStore = () => {};
    let applying = false;

    async function pushState(userId: string, session: any) {
      try {
        const state = snapshot();
        await supabase.from("user_states").upsert({
          user_id: userId,
          state,
          updated_at: new Date().toISOString(),
        });

        // Version publique simplifiée pour les abonnements
        const publicState = {
          followed: state.followed || [],
          moviesWatched: state.moviesWatched || [],
          booksRead: state.booksRead || [],
          showCache: state.showCache || {},
          movieCache: state.movieCache || {},
          bookCache: state.bookCache || {},
        };

        const firstName = session?.user?.user_metadata?.first_name || "";
        const lastName = session?.user?.user_metadata?.last_name || "";
        const avatar = session?.user?.user_metadata?.avatar || "🍿";

        await supabase.from("profiles").upsert({
          id: userId,
          email: session?.user?.email || "",
          first_name: firstName,
          last_name: lastName,
          avatar_url: avatar,
          public_state: publicState,
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
              void pushState(userId, session);
            } else {
              void pushState(userId, session);
            }

            // S'abonner aux changements du store local
            unsubStore = useTrack.subscribe(() => {
              if (applying) return;
              clearTimeout(timer);
              timer = setTimeout(() => pushState(userId, session), 1500);
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
