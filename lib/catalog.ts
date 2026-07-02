// Couche catalogue côté serveur : TMDB si TMDB_API_KEY est définie,
// sinon repli sur le catalogue de démonstration (lib/data.ts).
// En cas d'erreur TMDB (clé invalide, réseau), on retombe aussi sur la démo.

import { GENRES, MOVIES, SHOWS, getMovie, getShow } from "./data";
import type { Movie, Show, Review } from "./types";

const IMG = "https://image.tmdb.org/t/p/";

const TV_GENRES: Record<number, string> = {
  10759: "Action & Aventure",
  16: "Animation",
  35: "Comédie",
  80: "Crime",
  99: "Documentaire",
  18: "Drame",
  10751: "Familial",
  10762: "Enfants",
  9648: "Mystère",
  10763: "News",
  10764: "Réalité",
  10765: "Science-Fiction & Fantastique",
  10766: "Feuilleton",
  10767: "Talk",
  10768: "Guerre & Politique",
  37: "Western",
};

const MOVIE_GENRES: Record<number, string> = {
  28: "Action",
  12: "Aventure",
  16: "Animation",
  35: "Comédie",
  80: "Crime",
  99: "Documentaire",
  18: "Drame",
  10751: "Familial",
  14: "Fantastique",
  36: "Histoire",
  27: "Horreur",
  10402: "Musique",
  9648: "Mystère",
  10749: "Romance",
  878: "Science-Fiction",
  10770: "Téléfilm",
  53: "Thriller",
  10752: "Guerre",
  37: "Western",
};

// Genres proposés dans les filtres de l'onglet Découvrir (mode TMDB)
const TV_GENRE_FILTERS = [
  "Action & Aventure",
  "Animation",
  "Comédie",
  "Crime",
  "Documentaire",
  "Drame",
  "Familial",
  "Mystère",
  "Réalité",
  "Science-Fiction & Fantastique",
  "Guerre & Politique",
  "Western",
];

const TV_GENRE_ID = Object.fromEntries(
  Object.entries(TV_GENRES).map(([id, name]) => [name, Number(id)])
);

function hasTmdb() {
  return !!process.env.TMDB_API_KEY;
}

async function tmdb(path: string, params: Record<string, string> = {}) {
  const key = process.env.TMDB_API_KEY!;
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("language", "fr-FR");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  // Jeton v4 (commence par "eyJ") en header, sinon clé v3 en paramètre
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  const res = await fetch(url, { headers, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB ${res.status} sur ${path}`);
  return res.json();
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapShowSummary(r: any): Show {
  return {
    id: r.id,
    title: r.name,
    year: r.first_air_date ? Number(r.first_air_date.slice(0, 4)) : 0,
    genres: (r.genre_ids ?? [])
      .map((g: number) => TV_GENRES[g])
      .filter(Boolean),
    overview: r.overview ?? "",
    poster: r.poster_path ? `${IMG}w342${r.poster_path}` : null,
    rating: r.vote_average || undefined,
  };
}

function mapMovieSummary(r: any): Movie {
  return {
    id: r.id,
    title: r.title,
    year: r.release_date ? Number(r.release_date.slice(0, 4)) : 0,
    genres: (r.genre_ids ?? [])
      .map((g: number) => MOVIE_GENRES[g])
      .filter(Boolean),
    overview: r.overview ?? "",
    poster: r.poster_path ? `${IMG}w342${r.poster_path}` : null,
    rating: r.vote_average || undefined,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listShows(q?: string, genre?: string): Promise<Show[]> {
  if (hasTmdb()) {
    try {
      let results: unknown[];
      if (q) {
        const data = await tmdb("/search/tv", {
          query: q,
          include_adult: "false",
        });
        results = data.results ?? [];
      } else if (genre && TV_GENRE_ID[genre]) {
        const data = await tmdb("/discover/tv", {
          with_genres: String(TV_GENRE_ID[genre]),
          sort_by: "popularity.desc",
        });
        results = data.results ?? [];
      } else {
        const data = await tmdb("/trending/tv/week");
        results = data.results ?? [];
      }
      let shows = results.map(mapShowSummary).filter((s) => s.title);
      if (q && genre) shows = shows.filter((s) => s.genres.includes(genre));
      return shows;
    } catch (err) {
      console.error("TMDB indisponible, repli sur la démo :", err);
    }
  }
  const lq = q?.trim().toLowerCase();
  return SHOWS.filter(
    (s) =>
      (!lq || s.title.toLowerCase().includes(lq)) &&
      (!genre || s.genres.includes(genre))
  ).sort((a, b) => Number(b.trending ?? false) - Number(a.trending ?? false));
}

export async function getShowDetail(id: number): Promise<Show | null> {
  if (hasTmdb()) {
    try {
      const d = await tmdb(`/tv/${id}`);
      const nums: number[] = (d.seasons ?? [])
        .filter((s: { season_number: number }) => s.season_number > 0)
        .map((s: { season_number: number }) => s.season_number);
      const seasonData = await Promise.all(
        nums.map((n) => tmdb(`/tv/${id}/season/${n}`).catch(() => null))
      );
      return {
        id: d.id,
        title: d.name,
        year: d.first_air_date ? Number(d.first_air_date.slice(0, 4)) : 0,
        genres: (d.genres ?? []).map((g: { name: string }) => g.name),
        overview: d.overview ?? "",
        poster: d.poster_path ? `${IMG}w342${d.poster_path}` : null,
        backdrop: d.backdrop_path ? `${IMG}w780${d.backdrop_path}` : null,
        rating: d.vote_average || undefined,
        status: ["Ended", "Canceled"].includes(d.status)
          ? "Terminée"
          : "En cours",
        runtime:
          d.episode_run_time?.[0] ?? d.last_episode_to_air?.runtime ?? 40,
        seasons: seasonData
          .filter(Boolean)
          .map((sd) => ({
            n: sd.season_number,
            episodes: (sd.episodes ?? []).map(
              (ep: {
                season_number: number;
                episode_number: number;
                name?: string;
                air_date?: string;
              }) => ({
                s: ep.season_number,
                e: ep.episode_number,
                title: ep.name || `Épisode ${ep.episode_number}`,
                airDate: ep.air_date ?? null,
              })
            ),
          }))
          .filter((s) => s.episodes.length > 0),
      };
    } catch (err) {
      console.error("TMDB indisponible, repli sur la démo :", err);
    }
  }
  return getShow(id) ?? null;
}

export async function listMovies(q?: string): Promise<Movie[]> {
  if (hasTmdb()) {
    try {
      const data = q
        ? await tmdb("/search/movie", { query: q, include_adult: "false" })
        : await tmdb("/movie/popular");
      return (data.results ?? []).map(mapMovieSummary).filter((m: Movie) => m.title);
    } catch (err) {
      console.error("TMDB indisponible, repli sur la démo :", err);
    }
  }
  const lq = q?.trim().toLowerCase();
  return MOVIES.filter((m) => !lq || m.title.toLowerCase().includes(lq));
}

export async function getMovieDetail(id: number): Promise<Movie | null> {
  if (hasTmdb()) {
    try {
      const d = await tmdb(`/movie/${id}`);
      return {
        id: d.id,
        title: d.title,
        year: d.release_date ? Number(d.release_date.slice(0, 4)) : 0,
        genres: (d.genres ?? []).map((g: { name: string }) => g.name),
        overview: d.overview ?? "",
        poster: d.poster_path ? `${IMG}w342${d.poster_path}` : null,
        runtime: d.runtime || undefined,
        rating: d.vote_average || undefined,
      };
    } catch (err) {
      console.error("TMDB indisponible, repli sur la démo :", err);
    }
  }
  return getMovie(id) ?? null;
}

export async function listGenres(): Promise<string[]> {
  if (hasTmdb()) return TV_GENRE_FILTERS;
  return GENRES;
}

export async function getShowReviews(id: number): Promise<Review[]> {
  if (hasTmdb()) {
    try {
      const data = await tmdb(`/tv/${id}/reviews`);
      return (data.results ?? []).map((r: any) => ({
        id: r.id,
        author: r.author_details?.name || r.author_details?.username || r.author,
        avatar: r.author_details?.avatar_path ? (r.author_details.avatar_path.startsWith("http") ? r.author_details.avatar_path : `${IMG}w185${r.author_details.avatar_path}`) : null,
        rating: r.author_details?.rating ?? null,
        content: r.content,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.error("TMDB reviews error for show :", err);
    }
  }
  return [
    {
      id: "demo-show-1",
      author: "Julien R.",
      rating: 9,
      content: "Une réalisation incroyable avec une direction artistique sublime. L'intrigue nous tient en haleine du début à la fin ! (Avis de démonstration)",
      createdAt: new Date().toISOString(),
    }
  ];
}

export async function getMovieReviews(id: number): Promise<Review[]> {
  if (hasTmdb()) {
    try {
      const data = await tmdb(`/movie/${id}/reviews`);
      return (data.results ?? []).map((r: any) => ({
        id: r.id,
        author: r.author_details?.name || r.author_details?.username || r.author,
        avatar: r.author_details?.avatar_path ? (r.author_details.avatar_path.startsWith("http") ? r.author_details.avatar_path : `${IMG}w185${r.author_details.avatar_path}`) : null,
        rating: r.author_details?.rating ?? null,
        content: r.content,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.error("TMDB reviews error for movie :", err);
    }
  }
  return [
    {
      id: "demo-movie-1",
      author: "Sophie L.",
      rating: 8,
      content: "Un excellent moment cinématographique. Les acteurs sont très convaincants et le rythme est parfait. (Avis de démonstration)",
      createdAt: new Date().toISOString(),
    }
  ];
}
