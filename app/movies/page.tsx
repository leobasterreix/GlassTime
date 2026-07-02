"use client";

import { useEffect, useState } from "react";
import Poster from "@/components/Poster";
import { apiGet, useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import { minutesHuman } from "@/lib/utils";
import type { Movie } from "@/lib/types";

type Tab = "watchlist" | "watched" | "discover";

export default function MoviesPage() {
  const mounted = useMounted();
  const {
    movieWatchlist,
    moviesWatched,
    movieCache,
    cacheMovie,
    toggleMovieWatchlist,
    toggleMovieWatched,
  } = useTrack();
  useHydrateLibrary();
  const [tab, setTab] = useState<Tab>("watchlist");
  const [query, setQuery] = useState("");
  const [discovered, setDiscovered] = useState<Movie[] | null>(null);

  const q = query.trim();
  useEffect(() => {
    if (tab !== "discover") return;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        const data = await apiGet<Movie[]>(`/api/movies?${params}`);
        if (!cancelled) setDiscovered(data ?? []);
      },
      q ? 350 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, q]);

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Films</h1>
        <p className="page-sub">Votre cinémathèque</p>
      </main>
    );
  }

  function addToWatchlist(m: Movie) {
    cacheMovie(m);
    toggleMovieWatchlist(m.id);
    if (!m.runtime)
      apiGet<Movie>(`/api/movie/${m.id}`).then((d) => d && cacheMovie(d));
  }

  function markWatched(m: Movie) {
    cacheMovie(m);
    toggleMovieWatched(m.id);
    if (!m.runtime)
      apiGet<Movie>(`/api/movie/${m.id}`).then((d) => d && cacheMovie(d));
  }

  const lists: Record<Tab, Movie[]> = {
    watchlist: movieWatchlist.map((id) => movieCache[id]).filter(Boolean),
    watched: moviesWatched.map((id) => movieCache[id]).filter(Boolean),
    discover: (discovered ?? []).filter(
      (m) => !movieWatchlist.includes(m.id) && !moviesWatched.includes(m.id)
    ),
  };
  const current = lists[tab];

  const emptyText: Record<Tab, string> = {
    watchlist: "Aucun film dans votre liste. Parcourez l'onglet Découvrir !",
    watched: "Vous n'avez encore marqué aucun film comme vu.",
    discover:
      tab === "discover" && discovered === null
        ? "Chargement…"
        : q
          ? "Aucun film ne correspond à votre recherche."
          : "Rien à découvrir pour le moment.",
  };

  return (
    <main className="page">
      <h1 className="page-title">Films</h1>
      <p className="page-sub">Votre cinémathèque</p>

      <div className="glass segmented" style={{ marginBottom: 16 }}>
        <button
          className={tab === "watchlist" ? "active" : ""}
          onClick={() => setTab("watchlist")}
        >
          À voir · {movieWatchlist.length}
        </button>
        <button
          className={tab === "watched" ? "active" : ""}
          onClick={() => setTab("watched")}
        >
          Vus · {moviesWatched.length}
        </button>
        <button
          className={tab === "discover" ? "active" : ""}
          onClick={() => setTab("discover")}
        >
          Découvrir
        </button>
      </div>

      {tab === "discover" && (
        <div className="glass search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--text-3)" }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            placeholder="Rechercher un film…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {current.length === 0 ? (
        <div className="glass empty">
          <div className="big">🎬</div>
          <p className="muted">{emptyText[tab]}</p>
        </div>
      ) : (
        <div className="stack stack-wide">
          {current.map((m) => {
            const inList = movieWatchlist.includes(m.id);
            const seen = moviesWatched.includes(m.id);
            const meta = [
              m.year || null,
              m.runtime ? minutesHuman(m.runtime) : null,
              m.rating ? `★ ${m.rating.toFixed(1)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={m.id} className="glass card row">
                <Poster item={m} mini />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>
                    {m.title}
                  </div>
                  {meta && (
                    <div className="muted" style={{ marginTop: 2 }}>
                      {meta}
                    </div>
                  )}
                  {m.genres.length > 0 && (
                    <div className="tiny" style={{ marginTop: 2 }}>
                      {m.genres.slice(0, 3).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {!seen && (
                    <button
                      className={`check small${inList ? " checked" : ""}`}
                      aria-label="Liste à voir"
                      title="À voir"
                      onClick={() =>
                        inList ? toggleMovieWatchlist(m.id) : addToWatchlist(m)
                      }
                    >
                      {inList ? "✓" : "+"}
                    </button>
                  )}
                  <button
                    className={`check${seen ? " checked" : ""}`}
                    aria-label="Marquer comme vu"
                    title="Vu"
                    onClick={() =>
                      seen ? toggleMovieWatched(m.id) : markWatched(m)
                    }
                  >
                    👁
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
