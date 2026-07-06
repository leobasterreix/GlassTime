"use client";

import { useEffect } from "react";
import type { Book, Movie, Show } from "./types";
import { useMounted, useTrack } from "./store";
import { toast } from "./toast";

export async function apiGet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Récupère un lot d'IDs via une route /batch, en le découpant en petits
 * groupes envoyés en parallèle : chaque groupe reste rapide côté serveur
 * (peu d'appels externes en Promise.all) et un groupe lent/en échec ne
 * bloque pas l'arrivée des autres, contrairement à un unique gros batch.
 */
function fetchBatched<T>(
  path: string,
  ids: (string | number)[],
  chunkSize: number
): Promise<T[]>[] {
  return chunk(ids, chunkSize).map((group) =>
    apiGet<T[]>(`${path}?ids=${group.join(",")}`).then((r) => r ?? [])
  );
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
    toast(`${summary.title} ajoutée à vos séries`, "📺");
  } else {
    toast(`${summary.title} retirée de vos séries`, "↩️");
  }
}

/**
 * Complète le cache local : fiches manquantes des séries suivies
 * (saisons nécessaires à l'accueil et à l'agenda), des films et des livres listés.
 */
const fetchedBookIds = new Set<string>();

export function useHydrateLibrary() {
  const mounted = useMounted();
  const followed = useTrack((st) => st.followed);
  const movieWatchlist = useTrack((st) => st.movieWatchlist);
  const moviesWatched = useTrack((st) => st.moviesWatched);
  const booksWatchlist = useTrack((st) => st.booksWatchlist);
  const booksRead = useTrack((st) => st.booksRead);
  // Un favori peut ne pas être suivi/dans une liste par ailleurs (ex: favori
  // "coup de cœur" sur une série qu'on ne suit pas activement) : il faut donc
  // aussi hydrater son cache, sinon il n'a pas de fiche à afficher.
  const favoriteShows = useTrack((st) => st.favoriteShows);
  const favoriteMovies = useTrack((st) => st.favoriteMovies);
  const favoriteBooks = useTrack((st) => st.favoriteBooks);

  useEffect(() => {
    if (!mounted) return;
    const { showCache, movieCache, bookCache, cacheShow, cacheMovie, cacheBook } =
      useTrack.getState();

    // Quelques requêtes groupées par type de média (au lieu d'un fetch par
    // fiche manquante) : évite la rafale de requêtes quand la bibliothèque
    // suivie compte plusieurs dizaines d'entrées, sans pour autant tout miser
    // sur un seul gros batch qui bloquerait tout si un élément traîne.
    const missingShowIds = [...new Set([...followed, ...favoriteShows])].filter(
      (id) => !showCache[id]?.seasons?.length
    );
    fetchBatched<Show>("/api/show/batch", missingShowIds, 5).forEach((p) =>
      p.then((shows) => shows.forEach(cacheShow))
    );

    const missingMovieIds = [
      ...new Set([...movieWatchlist, ...moviesWatched, ...favoriteMovies]),
    ].filter((id) => !movieCache[id]?.runtime);
    fetchBatched<Movie>("/api/movie/batch", missingMovieIds, 8).forEach((p) =>
      p.then((movies) => movies.forEach(cacheMovie))
    );

    // Le Set évite les re-fetch en boucle quand un livre reste introuvable
    const missingBookIds = [
      ...new Set([...booksWatchlist, ...booksRead, ...favoriteBooks]),
    ].filter((id) => !bookCache[id] && !fetchedBookIds.has(id));
    missingBookIds.forEach((id) => fetchedBookIds.add(id));
    fetchBatched<Book>("/api/book/batch", missingBookIds, 10).forEach((p) =>
      p.then((books) => books.forEach(cacheBook))
    );
  }, [
    mounted,
    followed,
    movieWatchlist,
    moviesWatched,
    booksWatchlist,
    booksRead,
    favoriteShows,
    favoriteMovies,
    favoriteBooks,
  ]);
}
