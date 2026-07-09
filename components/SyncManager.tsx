"use client";

import { useEffect } from "react";
import { useTrack } from "@/lib/store";
import { applyAccent } from "@/lib/accent";
import { supabase } from "@/lib/supabaseClient";
import { syncStatus } from "@/lib/syncStatus";

// Synchronisation multi-appareils via Supabase.
// Au chargement/connexion : le plus récent (local ou serveur) gagne, d'après updatedAt.
// Ensuite : chaque modification locale est poussée après 1,5 s d'inactivité.

// On ne synchronise QUE les données utilisateur (ce qu'on a suivi/vu/aimé), pas
// les caches de fiches (showCache/movieCache/bookCache). Ces caches, avec toutes
// les saisons et épisodes de chaque série, faisaient gonfler le blob à plusieurs
// centaines de Ko — et il fallait le télécharger en entier avant d'afficher quoi
// que ce soit au premier login (très lent sur mobile). Les fiches sont de toute
// façon reconstruites à la volée via les routes /api/*/batch (useHydrateLibrary),
// donc les persister côté serveur ne faisait que ralentir chaque login et chaque
// sauvegarde pour rien.
const SYNC_KEYS = [
  "followed",
  "watched",
  "movieWatchlist",
  "moviesWatched",
  "moviesWatchedDates",
  "booksWatchlist",
  "booksRead",
  "booksReadDates",
  "showStatus",
  "watchedLog",
  "accent",
  "favoriteShows",
  "favoriteMovies",
  "favoriteBooks",
  "myPlatforms",
  "notifications",
  "ambiance",
  "glassIntensity",
  "avatarEmoji",
  "yearlyGoals",
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
  const ambiance = useTrack((st) => st.ambiance);
  const glassIntensity = useTrack((st) => st.glassIntensity);

  // Ambiance et intensité du verre : simples attributs sur <html>, le CSS
  // fait le reste ([data-ambiance] / [data-glass] dans globals.css).
  useEffect(() => {
    document.documentElement.setAttribute("data-ambiance", ambiance ?? "aurora");
    document.documentElement.setAttribute("data-glass", glassIntensity ?? "normal");
  }, [ambiance, glassIntensity]);

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

    // Upsert de l'identité + de l'état public (visible des amis suivis) —
    // exécuté pour tous les comptes, gratuits comme Premium, car il ne s'agit
    // pas de synchronisation multi-appareils mais du profil social de base.
    async function pushProfile(userId: string, session: any) {
      try {
        const state = snapshot();

        // Les caches ne sont plus dans le snapshot synchronisé : on les lit ici
        // directement depuis le store (en mémoire) pour construire les affiches
        // publiques du fil communauté.
        const live = useTrack.getState() as unknown as Record<string, any>;

        // Version publique simplifiée pour les abonnements (élaguée pour ne pas saturer la base de données)
        const prunedShowCache: Record<number, any> = {};
        if (live.showCache) {
          for (const [idStr, show] of Object.entries(live.showCache)) {
            const s = show as any;
            if (s) {
              prunedShowCache[Number(idStr)] = {
                id: s.id,
                title: s.title,
                poster: s.poster,
                year: s.year,
                status: s.status,
                genres: s.genres,
                rating: s.rating,
              };
            }
          }
        }

        const prunedMovieCache: Record<number, any> = {};
        if (live.movieCache) {
          for (const [idStr, movie] of Object.entries(live.movieCache)) {
            const m = movie as any;
            if (m) {
              prunedMovieCache[Number(idStr)] = {
                id: m.id,
                title: m.title,
                poster: m.poster,
                year: m.year,
                genres: m.genres,
                rating: m.rating,
              };
            }
          }
        }

        const prunedBookCache: Record<string, any> = {};
        if (live.bookCache) {
          for (const [id, book] of Object.entries(live.bookCache)) {
            const b = book as any;
            if (b) {
              prunedBookCache[id] = {
                id: b.id,
                title: b.title,
                poster: b.poster,
                authors: b.authors,
                publishedDate: b.publishedDate,
              };
            }
          }
        }

        const publicState = {
          followed: state.followed || [],
          moviesWatched: state.moviesWatched || [],
          booksRead: state.booksRead || [],
          showCache: prunedShowCache,
          movieCache: prunedMovieCache,
          bookCache: prunedBookCache,
          favoriteShows: state.favoriteShows || [],
          favoriteMovies: state.favoriteMovies || [],
          favoriteBooks: state.favoriteBooks || [],
          recentActivities: state.recentActivities || [],
          episodeReviews: state.episodeReviews || {},
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

    // Synchronisation multi-appareils (table user_states) — fonctionnalité
    // Premium : pousse l'état complet suivi/vu/aimé + le profil public.
    async function pushUserState(userId: string, session: any) {
      try {
        syncStatus.set("syncing");
        await supabase.from("user_states").upsert({
          user_id: userId,
          state: snapshot(),
          updated_at: new Date().toISOString(),
        });
        await pushProfile(userId, session);
        syncStatus.set("synced");
      } catch (err) {
        console.error("Erreur de sauvegarde Supabase :", err);
        syncStatus.set("error");
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        unsubStore();
        clearTimeout(timer);

        if (session?.user) {
          const userId = session.user.id;

          try {
            const { data: profileRow } = await supabase
              .from("profiles")
              .select("subscription_plan")
              .eq("id", userId)
              .maybeSingle();
            const isPremium = profileRow?.subscription_plan === "premium";
            useTrack.setState({ subscriptionPlan: isPremium ? "premium" : "free" });

            if (!isPremium) {
              // Pas de sync multi-appareils sur le plan Gratuit (l'état suivi/vu
              // reste local à cet appareil) — on garde quand même l'identité et
              // le profil public à jour pour les fonctionnalités communautaires.
              void pushProfile(userId, session);
              return;
            }

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
              void pushUserState(userId, session);
            } else {
              void pushUserState(userId, session);
            }

            // S'abonner aux changements du store local
            unsubStore = useTrack.subscribe(() => {
              if (applying) return;
              clearTimeout(timer);
              timer = setTimeout(() => pushUserState(userId, session), 1500);
            });
          } catch (err) {
            console.error("Erreur de réconciliation initiale :", err);
          }
        } else {
          useTrack.setState({ subscriptionPlan: "free" });
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
