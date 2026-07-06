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

    // Un seul aller-retour réseau par type de média (au lieu d'un fetch par
    // fiche manquante) : évite la rafale de requêtes quand la bibliothèque
    // suivie compte plusieurs dizaines d'entrées.
    const missingShowIds = [...new Set([...followed, ...favoriteShows])].filter(
      (id) => !showCache[id]?.seasons?.length
    );
    if (missingShowIds.length) {
      apiGet<Show[]>(`/api/show/batch?ids=${missingShowIds.join(",")}`).then(
        (shows) => shows?.forEach(cacheShow)
      );
    }

    const missingMovieIds = [
      ...new Set([...movieWatchlist, ...moviesWatched, ...favoriteMovies]),
    ].filter((id) => !movieCache[id]?.runtime);
    if (missingMovieIds.length) {
      apiGet<Movie[]>(`/api/movie/batch?ids=${missingMovieIds.join(",")}`).then(
        (movies) => movies?.forEach(cacheMovie)
      );
    }

    // Le Set évite les re-fetch en boucle quand un livre reste introuvable
    const missingBookIds = [
      ...new Set([...booksWatchlist, ...booksRead, ...favoriteBooks]),
    ].filter((id) => !bookCache[id] && !fetchedBookIds.has(id));
    if (missingBookIds.length) {
      missingBookIds.forEach((id) => fetchedBookIds.add(id));
      apiGet<Book[]>(`/api/book/batch?ids=${missingBookIds.join(",")}`).then(
        (books) => books?.forEach(cacheBook)
      );
    }
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
