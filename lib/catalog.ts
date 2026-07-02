// Couche catalogue : Requêtes vers TMDB si TMDB_API_KEY est définie.

import type { CastMember, Movie, Provider, Review, Show } from "./types";

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
  if (!path.endsWith("/reviews")) {
    url.searchParams.set("language", "fr-FR");
  }
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  
  const res = await fetch(url, { headers, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB ${res.status} sur ${path}`);
  return res.json();
}

/** Plateformes de streaming disponibles en France (données JustWatch via TMDB). */
async function fetchProviders(type: "tv" | "movie", id: number): Promise<Provider[]> {
  try {
    const d = await tmdb(`/${type}/${id}/watch/providers`);
    const fr = d.results?.FR;
    if (!fr) return [];
    const seen = new Set<number>();
    const providers: Provider[] = [];
    for (const p of [...(fr.flatrate ?? []), ...(fr.free ?? []), ...(fr.ads ?? [])]) {
      if (seen.has(p.provider_id)) continue;
      seen.add(p.provider_id);
      providers.push({
        name: p.provider_name,
        logo: p.logo_path ? `${IMG}w92${p.logo_path}` : null,
      });
    }
    return providers.slice(0, 6);
  } catch {
    return [];
  }
}

/** Têtes d'affiche (10 premiers rôles). */
async function fetchCast(type: "tv" | "movie", id: number): Promise<CastMember[]> {
  try {
    const path =
      type === "tv" ? `/tv/${id}/aggregate_credits` : `/movie/${id}/credits`;
    const d = await tmdb(path);
    return (d.cast ?? []).slice(0, 10).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.roles?.[0]?.character ?? c.character ?? undefined,
      photo: c.profile_path ? `${IMG}w185${c.profile_path}` : null,
    }));
  } catch {
    return [];
  }
}

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
    releaseDate: r.release_date || null,
  };
}

/**
 * Recommandations personnalisées : fusion des suggestions TMDB
 * pour un échantillon de fiches suivies, triées par popularité.
 */
export async function getRecommendations(
  type: "tv" | "movie",
  ids: number[]
): Promise<(Show | Movie)[]> {
  if (!hasTmdb() || ids.length === 0) return [];
  try {
    const sample = ids.slice(0, 4);
    const responses = await Promise.all(
      sample.map((id) =>
        tmdb(`/${type}/${id}/recommendations`).catch(() => ({ results: [] }))
      )
    );
    const seen = new Set<number>(ids);
    const merged: { item: Show | Movie; popularity: number }[] = [];
    for (const res of responses) {
      for (const r of res.results ?? []) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        merged.push({
          item: type === "tv" ? mapShowSummary(r) : mapMovieSummary(r),
          popularity: r.popularity ?? 0,
        });
      }
    }
    return merged
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 20)
      .map((x) => x.item)
      .filter((x) => x.title);
  } catch (err) {
    console.error("TMDB error getRecommendations:", err);
    return [];
  }
}

export async function listShows(q?: string, genre?: string): Promise<Show[]> {
  if (!hasTmdb()) return [];
  try {
    let results: any[];
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
    console.error("TMDB error listShows:", err);
    return [];
  }
}

export async function getShowDetail(id: number): Promise<Show | null> {
  if (!hasTmdb()) return null;
  try {
    const [d, videosData, providers, cast] = await Promise.all([
      tmdb(`/tv/${id}`),
      tmdb(`/tv/${id}/videos`, { language: "fr-FR" }).catch(() => ({ results: [] })),
      fetchProviders("tv", id),
      fetchCast("tv", id),
    ]);
    const nums: number[] = (d.seasons ?? [])
      .filter((s: { season_number: number }) => s.season_number > 0)
      .map((s: { season_number: number }) => s.season_number);
    const seasonData = await Promise.all(
      nums.map((n) => tmdb(`/tv/${id}/season/${n}`).catch(() => null))
    );

    // Pick best trailer: prefer FR, fallback to EN
    let trailerKey: string | undefined;
    const vids: any[] = videosData.results ?? [];
    const trailer = vids.find((v: any) => v.site === "YouTube" && v.type === "Trailer" && v.iso_639_1 === "fr")
      ?? vids.find((v: any) => v.site === "YouTube" && v.type === "Trailer")
      ?? vids.find((v: any) => v.site === "YouTube" && v.type === "Teaser");
    if (trailer) trailerKey = trailer.key;
    // If no FR trailers found, try EN endpoint
    if (!trailerKey) {
      try {
        const enVids = await tmdb(`/tv/${id}/videos`, { language: "en-US" });
        const enTrailer = (enVids.results ?? []).find((v: any) => v.site === "YouTube" && v.type === "Trailer")
          ?? (enVids.results ?? []).find((v: any) => v.site === "YouTube" && v.type === "Teaser");
        if (enTrailer) trailerKey = enTrailer.key;
      } catch { /* ignore */ }
    }

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
      trailerKey,
      providers,
      cast,
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
    console.error("TMDB error getShowDetail:", err);
    return null;
  }
}

export async function listMovies(q?: string): Promise<Movie[]> {
  if (!hasTmdb()) return [];
  try {
    const data = q
      ? await tmdb("/search/movie", { query: q, include_adult: "false" })
      : await tmdb("/movie/popular");
    return (data.results ?? []).map(mapMovieSummary).filter((m: Movie) => m.title);
  } catch (err) {
    console.error("TMDB error listMovies:", err);
    return [];
  }
}

export async function getMovieDetail(id: number): Promise<Movie | null> {
  if (!hasTmdb()) return null;
  try {
    const [d, videosData, providers, cast] = await Promise.all([
      tmdb(`/movie/${id}`),
      tmdb(`/movie/${id}/videos`, { language: "fr-FR" }).catch(() => ({ results: [] })),
      fetchProviders("movie", id),
      fetchCast("movie", id),
    ]);

    // Pick best trailer: prefer FR, fallback to EN
    let trailerKey: string | undefined;
    const vids: any[] = videosData.results ?? [];
    const trailer = vids.find((v: any) => v.site === "YouTube" && v.type === "Trailer" && v.iso_639_1 === "fr")
      ?? vids.find((v: any) => v.site === "YouTube" && v.type === "Trailer")
      ?? vids.find((v: any) => v.site === "YouTube" && v.type === "Teaser");
    if (trailer) trailerKey = trailer.key;
    // If no FR trailers found, try EN endpoint
    if (!trailerKey) {
      try {
        const enVids = await tmdb(`/movie/${id}/videos`, { language: "en-US" });
        const enTrailer = (enVids.results ?? []).find((v: any) => v.site === "YouTube" && v.type === "Trailer")
          ?? (enVids.results ?? []).find((v: any) => v.site === "YouTube" && v.type === "Teaser");
        if (enTrailer) trailerKey = enTrailer.key;
      } catch { /* ignore */ }
    }

    return {
      id: d.id,
      title: d.title,
      year: d.release_date ? Number(d.release_date.slice(0, 4)) : 0,
      genres: (d.genres ?? []).map((g: { name: string }) => g.name),
      overview: d.overview ?? "",
      poster: d.poster_path ? `${IMG}w342${d.poster_path}` : null,
      runtime: d.runtime || undefined,
      rating: d.vote_average || undefined,
      releaseDate: d.release_date || null,
      trailerKey,
      providers,
      cast,
    };
  } catch (err) {
    console.error("TMDB error getMovieDetail:", err);
    return null;
  }
}

export async function listGenres(): Promise<string[]> {
  return TV_GENRE_FILTERS;
}

export async function getShowReviews(id: number): Promise<Review[]> {
  if (!hasTmdb()) return [];
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
    console.error("TMDB error getShowReviews:", err);
    return [];
  }
}

export async function getMovieReviews(id: number): Promise<Review[]> {
  if (!hasTmdb()) return [];
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
    console.error("TMDB error getMovieReviews:", err);
    return [];
  }
}
