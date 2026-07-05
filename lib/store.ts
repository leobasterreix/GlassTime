"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { Movie, Show, Book } from "./types";
import { epKey } from "./utils";

/** N'écrit jamais en levant : Safari a un quota localStorage bien plus
 * restrictif que Chrome, et un cache qui grossit avec beaucoup de séries/
 * films suivis peut le dépasser — sans ce filet, ça plantait toute l'appli
 * (QuotaExceededError pendant la réconciliation initiale de zustand/persist). */
const safeStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (err) {
      console.error("Stockage local plein, sauvegarde ignorée :", err);
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

/** Les fiches détaillées (cast, bande-annonce, plateformes, résumé) ne sont
 * jamais relues depuis le cache — les pages détail refetchent toujours en
 * direct au montage. Les garder en mémoire pendant la session est utile,
 * mais les persister ne fait que gonfler le quota localStorage pour rien. */
function trimShowForStorage(s: Show): Show {
  return { ...s, overview: "", cast: undefined, trailerKey: undefined, providers: undefined, backdrop: undefined };
}
function trimMovieForStorage(m: Movie): Movie {
  return { ...m, overview: "", cast: undefined, trailerKey: undefined, providers: undefined };
}
function trimBookForStorage(b: Book): Book {
  return { ...b, overview: "" };
}

export type ShowFollowStatus = "active" | "paused" | "dropped";

export type AppNotification = {
  id: string;
  message: string;
  emoji: string;
  href?: string;
  createdAt: string;
  read: boolean;
};

export type DiscoverPrefs = {
  type: "shows" | "movies" | "books";
  query: string;
  genre: string | null;
  bookGenre: string | null;
  bookYear: string | null;
  bookMonth: string | null;
};

const DEFAULT_DISCOVER_PREFS: DiscoverPrefs = {
  type: "shows",
  query: "",
  genre: null,
  bookGenre: null,
  bookYear: null,
  bookMonth: null,
};

type TrackState = {
  followed: number[];
  watched: Record<number, Record<string, true>>;
  /** Dernière date (YYYY-MM-DD) où un épisode de la série a été marqué vu. */
  lastWatchedAt: Record<number, string>;
  movieWatchlist: number[];
  moviesWatched: number[];
  /** Date de visionnage des films (YYYY-MM-DD), comme booksReadDates. */
  moviesWatchedDates: Record<number, string>;
  booksWatchlist: string[];
  booksRead: string[];
  favoriteShows: number[];
  favoriteMovies: number[];
  favoriteBooks: string[];
  /** Statut de suivi par série : active (défaut), en pause, abandonnée. */
  showStatus: Record<number, ShowFollowStatus>;
  /** Journal d'activité : nombre d'éléments marqués par jour (YYYY-MM-DD). */
  watchedLog: Record<string, number>;
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
  setShowStatus: (id: number, status: ShowFollowStatus) => void;
  importState: (data: Record<string, unknown>) => void;
  toggleBookWatchlist: (id: string) => void;
  toggleBookRead: (id: string) => void;
  booksReadDates: Record<string, string>;
  setBookReadDate: (id: string, date: string | null) => void;
  clearAll: () => void;
  theme: "system" | "light" | "dark";
  toggleTheme: () => void;
  /** Couleur d'accent personnalisée (hex). null = corail par défaut. */
  accent: string | null;
  setAccent: (color: string | null) => void;
  localReviews: Record<string, { rating: number; content: string; createdAt: string }>;
  setLocalReview: (type: "movie" | "show" | "book", id: number | string, rating: number, content: string) => void;
  toggleFavoriteShow: (id: number) => void;
  toggleFavoriteMovie: (id: number) => void;
  toggleFavoriteBook: (id: string) => void;
  /** Plateformes de streaming possédées par l'utilisateur (ex. "Netflix"). */
  myPlatforms: string[];
  toggleMyPlatform: (name: string) => void;
  /** Centre de notifications in-app (distinct des notifications navigateur). */
  notifications: AppNotification[];
  pushNotification: (n: Omit<AppNotification, "createdAt" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  /** Dernière recherche Découvrir — survit au changement d'onglet (pas juste
   * au retour navigateur, qui lui passe par l'URL). */
  discoverPrefs: DiscoverPrefs;
  setDiscoverPrefs: (p: Partial<DiscoverPrefs>) => void;
  migrateDemoIds: () => void;
};

function toggleIn(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function toggleInStr(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Incrémente le journal d'activité du jour de `n` éléments (n<0 pour décocher). */
function bumpLog(log: Record<string, number>, n: number): Record<string, number> {
  const day = todayISO();
  const next = { ...log, [day]: Math.max(0, (log[day] ?? 0) + n) };
  if (next[day] === 0) delete next[day];
  return next;
}

export const useTrack = create<TrackState>()(
  persist(
    (set) => ({
      followed: [],
      watched: {},
      lastWatchedAt: {},
      movieWatchlist: [],
      moviesWatched: [],
      moviesWatchedDates: {},
      booksWatchlist: [],
      booksRead: [],
      booksReadDates: {},
      showCache: {},
      movieCache: {},
      bookCache: {},
      showStatus: {},
      watchedLog: {},
      localReviews: {},
      favoriteShows: [],
      favoriteMovies: [],
      favoriteBooks: [],
      myPlatforms: [],
      notifications: [],
      discoverPrefs: DEFAULT_DISCOVER_PREFS,
      updatedAt: 0,

      toggleFollow: (id) =>
        set((st) => ({
          followed: toggleIn(st.followed, id),
          updatedAt: Date.now(),
        })),

      toggleMyPlatform: (name) =>
        set((st) => ({
          myPlatforms: toggleInStr(st.myPlatforms ?? [], name),
          updatedAt: Date.now(),
        })),

      pushNotification: (n) =>
        set((st) => {
          if ((st.notifications ?? []).some((x) => x.id === n.id)) return {};
          return {
            notifications: [
              { ...n, createdAt: new Date().toISOString(), read: false },
              ...(st.notifications ?? []),
            ].slice(0, 50),
            updatedAt: Date.now(),
          };
        }),

      markNotificationRead: (id) =>
        set((st) => ({
          notifications: (st.notifications ?? []).map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllNotificationsRead: () =>
        set((st) => ({
          notifications: (st.notifications ?? []).map((n) => ({ ...n, read: true })),
        })),

      clearNotifications: () => set({ notifications: [] }),

      setDiscoverPrefs: (p) =>
        set((st) => ({ discoverPrefs: { ...st.discoverPrefs, ...p } })),

      toggleFavoriteShow: (id) =>
        set((st) => ({
          favoriteShows: toggleIn(st.favoriteShows ?? [], id),
          updatedAt: Date.now(),
        })),

      toggleFavoriteMovie: (id) =>
        set((st) => ({
          favoriteMovies: toggleIn(st.favoriteMovies ?? [], id),
          updatedAt: Date.now(),
        })),

      toggleFavoriteBook: (id) =>
        set((st) => ({
          favoriteBooks: toggleInStr(st.favoriteBooks ?? [], id),
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
          const had = !!map[epKey(s, e)];
          if (value) map[epKey(s, e)] = true;
          else delete map[epKey(s, e)];
          const delta = value && !had ? 1 : !value && had ? -1 : 0;
          return {
            watched: { ...st.watched, [showId]: map },
            // Horodatage complet (pas juste le jour) : sert aussi à faire
            // remonter la série en tête de « À rattraper » juste après un
            // marquage, pas seulement à calculer l'ancienneté en jours.
            lastWatchedAt: value
              ? { ...st.lastWatchedAt, [showId]: new Date().toISOString() }
              : st.lastWatchedAt,
            watchedLog: delta ? bumpLog(st.watchedLog, delta) : st.watchedLog,
            updatedAt: Date.now(),
          };
        }),

      setEpisodes: (showId, eps, value) =>
        set((st) => {
          const map = { ...(st.watched[showId] ?? {}) };
          let delta = 0;
          for (const { s, e } of eps) {
            const had = !!map[epKey(s, e)];
            if (value) {
              map[epKey(s, e)] = true;
              if (!had) delta++;
            } else {
              delete map[epKey(s, e)];
              if (had) delta--;
            }
          }
          return {
            watched: { ...st.watched, [showId]: map },
            // Horodatage complet (pas juste le jour) : sert aussi à faire
            // remonter la série en tête de « À rattraper » juste après un
            // marquage, pas seulement à calculer l'ancienneté en jours.
            lastWatchedAt: value
              ? { ...st.lastWatchedAt, [showId]: new Date().toISOString() }
              : st.lastWatchedAt,
            watchedLog: delta ? bumpLog(st.watchedLog, delta) : st.watchedLog,
            updatedAt: Date.now(),
          };
        }),

      toggleMovieWatchlist: (id) =>
        set((st) => ({
          movieWatchlist: toggleIn(st.movieWatchlist, id),
          updatedAt: Date.now(),
        })),

      toggleMovieWatched: (id) =>
        set((st) => {
          const nextWatched = toggleIn(st.moviesWatched, id);
          const nowWatched = nextWatched.includes(id);
          const nextDates = { ...st.moviesWatchedDates };
          if (nowWatched) nextDates[id] = todayISO();
          else delete nextDates[id];
          return {
            moviesWatched: nextWatched,
            moviesWatchedDates: nextDates,
            movieWatchlist: st.movieWatchlist.filter((x) => x !== id),
            watchedLog: bumpLog(st.watchedLog, nowWatched ? 1 : -1),
            updatedAt: Date.now(),
          };
        }),

      setShowStatus: (id, status) =>
        set((st) => ({
          showStatus: { ...st.showStatus, [id]: status },
          updatedAt: Date.now(),
        })),

      importState: (data) =>
        set(() => ({
          ...(data as Partial<TrackState>),
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
        set((st) => {
          const nextRead = toggleInStr(st.booksRead, id);
          const nextDates = { ...st.booksReadDates };
          if (nextRead.includes(id)) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            nextDates[id] = `${yyyy}-${mm}-${dd}`;
          } else {
            delete nextDates[id];
          }
          return {
            booksRead: nextRead,
            booksReadDates: nextDates,
            booksWatchlist: st.booksWatchlist.filter((x) => x !== id),
            watchedLog: bumpLog(st.watchedLog, nextRead.includes(id) ? 1 : -1),
            updatedAt: Date.now(),
          };
        }),

      setBookReadDate: (id, dateStr) =>
        set((st) => {
          const nextDates = { ...st.booksReadDates };
          if (dateStr) {
            nextDates[id] = dateStr;
          } else {
            delete nextDates[id];
          }
          return {
            booksReadDates: nextDates,
            updatedAt: Date.now(),
          };
        }),

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

      accent: null,

      setAccent: (color) => set({ accent: color, updatedAt: Date.now() }),

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
          lastWatchedAt: {},
          movieWatchlist: [],
          moviesWatched: [],
          moviesWatchedDates: {},
          booksWatchlist: [],
          booksRead: [],
          booksReadDates: {},
          showCache: {},
          movieCache: {},
          bookCache: {},
          showStatus: {},
          watchedLog: {},
          localReviews: {},
          favoriteShows: [],
          favoriteMovies: [],
          favoriteBooks: [],
          myPlatforms: [],
          notifications: [],
          discoverPrefs: DEFAULT_DISCOVER_PREFS,
          updatedAt: Date.now(),
        }),
    }),
    {
      name: "glasstime-store",
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        ...state,
        showCache: Object.fromEntries(
          Object.entries(state.showCache).map(([id, s]) => [id, trimShowForStorage(s)])
        ),
        movieCache: Object.fromEntries(
          Object.entries(state.movieCache).map(([id, m]) => [id, trimMovieForStorage(m)])
        ),
        bookCache: Object.fromEntries(
          Object.entries(state.bookCache).map(([id, b]) => [id, trimBookForStorage(b)])
        ),
      }),
    }
  )
);

/** Évite les erreurs d'hydratation : ne rendre l'état persisté qu'après montage. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
