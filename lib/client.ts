"use client";

import { useEffect } from "react";
import type { Movie, Show } from "./types";
import { useMounted, useTrack } from "./store";

export async function apiGet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Suit une série et récupère sa fiche complète (saisons) en arrière-plan. */
export function followShow(summary: Show) {
  const { followed, toggleFollow, cacheShow } = useTrack.getState();
  const wasFollowed = followed.includes(summary.id);
  toggleFollow(summary.id);
  if (!wasFollowed) {
    cacheShow(summary);
    if (!summary.seasons?.length) {
      apiGet<Show>(`/api/show/${summary.id}`).then(
        (d) => d && useTrack.getState().cacheShow(d)
      );
    }
  }
}

/**
 * Complète le cache local : fiches manquantes des séries suivies
 * (saisons nécessaires à l'accueil et à l'agenda) et des films listés.
 */
export function useHydrateLibrary() {
  const mounted = useMounted();
  const followed = useTrack((st) => st.followed);
  const movieWatchlist = useTrack((st) => st.movieWatchlist);
  const moviesWatched = useTrack((st) => st.moviesWatched);

  useEffect(() => {
    if (!mounted) return;
    const { showCache, movieCache, cacheShow, cacheMovie } =
      useTrack.getState();

    for (const id of followed) {
      if (showCache[id]?.seasons?.length) continue;
      apiGet<Show>(`/api/show/${id}`).then((s) => s && cacheShow(s));
    }
    for (const id of new Set([...movieWatchlist, ...moviesWatched])) {
      if (movieCache[id]?.runtime) continue;
      apiGet<Movie>(`/api/movie/${id}`).then((m) => m && cacheMovie(m));
    }
  }, [mounted, followed, movieWatchlist, moviesWatched]);
}
