"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Movie, Show, Book } from "./types";
import { epKey } from "./utils";

type TrackState = {
  followed: number[];
  watched: Record<number, Record<string, true>>;
  movieWatchlist: number[];
  moviesWatched: number[];
  booksWatchlist: string[];
  booksRead: string[];
  booksProgress: Record<string, number>;
  /** Horodatage de la dernière modification — sert d'arbitre à la synchronisation. */
  updatedAt: number;
  // Fiches conservées localement : l'accueil, l'agenda et le profil
  // fonctionnent sans rappeler l'API à chaque visite.
  showCache: Record<number, Show>;
  movieCache: Record<number, Movie>;
  bookCache: Record<string, Book>;
  toggleFollow: (id: number) => void;
  cacheShow: (show: Show) => void;
  cacheMovie: (movie: Movie) => void;
  cacheBook: (book: Book) => void;
  setEpisode: (showId: number, s: number, e: number, value: boolean) => void;
  setEpisodes: (
    showId: number,
    eps: { s: number; e: number }[],
    value: boolean
  ) => void;
  toggleMovieWatchlist: (id: number) => void;
  toggleMovieWatched: (id: number) => void;
  toggleBookWatchlist: (id: string) => void;
  toggleBookRead: (id: string) => void;
  setBookProgress: (id: string, pages: number) => void;
  clearAll: () => void;
  theme: "system" | "light" | "dark";
  toggleTheme: () => void;
  localReviews: Record<string, { rating: number; content: string; createdAt: string }>;
  setLocalReview: (type: "movie" | "show" | "book", id: number | string, rating: number, content: string) => void;
  migrateDemoIds: () => void;
};

function toggleIn(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function toggleInStr(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export const useTrack = create<TrackState>()(
  persist(
    (set) => ({
      followed: [],
      watched: {},
      movieWatchlist: [],
      moviesWatched: [],
      booksWatchlist: [],
      booksRead: [],
      showCache: {},
      movieCache: {},
      bookCache: {},
      booksProgress: {},
      localReviews: {},
      updatedAt: 0,

      toggleFollow: (id) =>
        set((st) => ({
          followed: toggleIn(st.followed, id),
          updatedAt: Date.now(),
        })),

      cacheShow: (show) =>
        set((st) => ({
          showCache: {
            ...st.showCache,
            // Fusion : un résumé (sans saisons) ne doit pas écraser une fiche complète
            [show.id]: { ...st.showCache[show.id], ...show },
          },
          updatedAt: Date.now(),
        })),

      cacheMovie: (movie) =>
        set((st) => ({
          movieCache: {
            ...st.movieCache,
            [movie.id]: { ...st.movieCache[movie.id], ...movie },
          },
          updatedAt: Date.now(),
        })),

      setEpisode: (showId, s, e, value) =>
        set((st) => {
          const map = { ...(st.watched[showId] ?? {}) };
          if (value) map[epKey(s, e)] = true;
          else delete map[epKey(s, e)];
          return {
            watched: { ...st.watched, [showId]: map },
            updatedAt: Date.now(),
          };
        }),

      setEpisodes: (showId, eps, value) =>
        set((st) => {
          const map = { ...(st.watched[showId] ?? {}) };
          for (const { s, e } of eps) {
            if (value) map[epKey(s, e)] = true;
            else delete map[epKey(s, e)];
          }
          return {
            watched: { ...st.watched, [showId]: map },
            updatedAt: Date.now(),
          };
        }),

      toggleMovieWatchlist: (id) =>
        set((st) => ({
          movieWatchlist: toggleIn(st.movieWatchlist, id),
          updatedAt: Date.now(),
        })),

      toggleMovieWatched: (id) =>
        set((st) => ({
          moviesWatched: toggleIn(st.moviesWatched, id),
          movieWatchlist: st.movieWatchlist.filter((x) => x !== id),
          updatedAt: Date.now(),
        })),

      cacheBook: (book) =>
        set((st) => ({
          bookCache: {
            ...st.bookCache,
            [book.id]: { ...st.bookCache[book.id], ...book },
          },
          updatedAt: Date.now(),
        })),

      toggleBookWatchlist: (id) =>
        set((st) => ({
          booksWatchlist: toggleInStr(st.booksWatchlist, id),
          updatedAt: Date.now(),
        })),

      toggleBookRead: (id) =>
        set((st) => ({
          booksRead: toggleInStr(st.booksRead, id),
          booksWatchlist: st.booksWatchlist.filter((x) => x !== id),
          updatedAt: Date.now(),
        })),

      setBookProgress: (id, pages) =>
        set((st) => ({
          booksProgress: {
            ...st.booksProgress,
            [id]: pages,
          },
          updatedAt: Date.now(),
        })),

      theme: "system",

      toggleTheme: () =>
        set((st) => {
          const next: Record<string, string> = {
            system: "light",
            light: "dark",
            dark: "system",
          };
          return {
            theme: (next[st.theme] ?? "system") as "system" | "light" | "dark",
          };
        }),

      setLocalReview: (type, id, rating, content) =>
        set((st) => ({
          localReviews: {
            ...st.localReviews,
            [`${type}-${id}`]: {
              rating,
              content,
              createdAt: new Date().toISOString(),
            },
          },
          updatedAt: Date.now(),
        })),

      migrateDemoIds: () =>
        set((st) => {
          const TV_MAPPING: Record<string, string> = {
            "1": "1396", "2": "66732", "3": "60625", "4": "1399", "5": "1668",
            "6": "1416", "7": "87108", "8": "57243", "9": "100088", "10": "76331",
            "11": "76479", "12": "60735", "13": "94605", "14": "97546", "15": "94997", "16": "116901"
          };
          const MOVIE_MAPPING: Record<string, string> = {
            "101": "27205", "102": "157336", "103": "496243", "104": "693134", "105": "872585",
            "106": "313369", "107": "129", "108": "155", "109": "680", "110": "194",
            "111": "703478", "112": "244786"
          };

          let changed = false;

          // Migrate followed TV shows
          const nextFollowed = st.followed.map((id) => {
            const mapped = TV_MAPPING[String(id)];
            if (mapped) { changed = true; return Number(mapped); }
            return id;
          });

          // Migrate watched series episode markers
          const nextWatched: Record<number, Record<string, true>> = {};
          for (const [key, value] of Object.entries(st.watched)) {
            const mapped = TV_MAPPING[key];
            if (mapped) {
              changed = true;
              nextWatched[Number(mapped)] = value;
            } else {
              nextWatched[Number(key)] = value;
            }
          }

          // Migrate movieWatchlist
          const nextMovieWatchlist = st.movieWatchlist.map((id) => {
            const mapped = MOVIE_MAPPING[String(id)];
            if (mapped) { changed = true; return Number(mapped); }
            return id;
          });

          // Migrate moviesWatched
          const nextMoviesWatched = st.moviesWatched.map((id) => {
            const mapped = MOVIE_MAPPING[String(id)];
            if (mapped) { changed = true; return Number(mapped); }
            return id;
          });

          // Clean showCache and movieCache of old keys
          const nextShowCache = { ...st.showCache };
          for (const key of Object.keys(TV_MAPPING)) {
            if (nextShowCache[Number(key)]) {
              changed = true;
              delete nextShowCache[Number(key)];
            }
          }
          const nextMovieCache = { ...st.movieCache };
          for (const key of Object.keys(MOVIE_MAPPING)) {
            if (nextMovieCache[Number(key)]) {
              changed = true;
              delete nextMovieCache[Number(key)];
            }
          }

          // Migrate localReviews keys
          const nextLocalReviews: Record<string, { rating: number; content: string; createdAt: string }> = {};
          for (const [key, value] of Object.entries(st.localReviews)) {
            const parts = key.split("-");
            if (parts.length === 2) {
              const [type, id] = parts;
              if (type === "show" && TV_MAPPING[id]) {
                changed = true;
                nextLocalReviews[`show-${TV_MAPPING[id]}`] = value;
              } else if (type === "movie" && MOVIE_MAPPING[id]) {
                changed = true;
                nextLocalReviews[`movie-${MOVIE_MAPPING[id]}`] = value;
              } else {
                nextLocalReviews[key] = value;
              }
            } else {
              nextLocalReviews[key] = value;
            }
          }

          if (changed) {
            return {
              followed: nextFollowed,
              watched: nextWatched,
              movieWatchlist: nextMovieWatchlist,
              moviesWatched: nextMoviesWatched,
              showCache: nextShowCache,
              movieCache: nextMovieCache,
              localReviews: nextLocalReviews,
              updatedAt: Date.now(),
            };
          }
          return {};
        }),

      clearAll: () =>
        set({
          followed: [],
          watched: {},
          movieWatchlist: [],
          moviesWatched: [],
          booksWatchlist: [],
          booksRead: [],
          showCache: {},
          movieCache: {},
          bookCache: {},
          booksProgress: {},
          localReviews: {},
          updatedAt: Date.now(),
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
