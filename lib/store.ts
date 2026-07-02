"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Movie, Show } from "./types";
import { epKey } from "./utils";

type TrackState = {
  followed: number[];
  watched: Record<number, Record<string, true>>;
  movieWatchlist: number[];
  moviesWatched: number[];
  // Fiches conservées localement : l'accueil, l'agenda et le profil
  // fonctionnent sans rappeler l'API à chaque visite.
  showCache: Record<number, Show>;
  movieCache: Record<number, Movie>;
  toggleFollow: (id: number) => void;
  cacheShow: (show: Show) => void;
  cacheMovie: (movie: Movie) => void;
  setEpisode: (showId: number, s: number, e: number, value: boolean) => void;
  setEpisodes: (
    showId: number,
    eps: { s: number; e: number }[],
    value: boolean
  ) => void;
  toggleMovieWatchlist: (id: number) => void;
  toggleMovieWatched: (id: number) => void;
  clearAll: () => void;
};

function toggleIn(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export const useTrack = create<TrackState>()(
  persist(
    (set) => ({
      followed: [],
      watched: {},
      movieWatchlist: [],
      moviesWatched: [],
      showCache: {},
      movieCache: {},

      toggleFollow: (id) =>
        set((st) => ({ followed: toggleIn(st.followed, id) })),

      cacheShow: (show) =>
        set((st) => ({
          showCache: {
            ...st.showCache,
            // Fusion : un résumé (sans saisons) ne doit pas écraser une fiche complète
            [show.id]: { ...st.showCache[show.id], ...show },
          },
        })),

      cacheMovie: (movie) =>
        set((st) => ({
          movieCache: {
            ...st.movieCache,
            [movie.id]: { ...st.movieCache[movie.id], ...movie },
          },
        })),

      setEpisode: (showId, s, e, value) =>
        set((st) => {
          const map = { ...(st.watched[showId] ?? {}) };
          if (value) map[epKey(s, e)] = true;
          else delete map[epKey(s, e)];
          return { watched: { ...st.watched, [showId]: map } };
        }),

      setEpisodes: (showId, eps, value) =>
        set((st) => {
          const map = { ...(st.watched[showId] ?? {}) };
          for (const { s, e } of eps) {
            if (value) map[epKey(s, e)] = true;
            else delete map[epKey(s, e)];
          }
          return { watched: { ...st.watched, [showId]: map } };
        }),

      toggleMovieWatchlist: (id) =>
        set((st) => ({ movieWatchlist: toggleIn(st.movieWatchlist, id) })),

      toggleMovieWatched: (id) =>
        set((st) => ({
          moviesWatched: toggleIn(st.moviesWatched, id),
          movieWatchlist: st.movieWatchlist.filter((x) => x !== id),
        })),

      clearAll: () =>
        set({
          followed: [],
          watched: {},
          movieWatchlist: [],
          moviesWatched: [],
          showCache: {},
          movieCache: {},
        }),
    }),
    { name: "glasstime-store" }
  )
);

/** Évite les erreurs d'hydratation : ne rendre l'état persisté qu'après montage. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
