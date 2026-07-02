"use client";

import { useState } from "react";
import Poster from "@/components/Poster";
import { MOVIES } from "@/lib/data";
import { useMounted, useTrack } from "@/lib/store";
import { minutesHuman } from "@/lib/utils";
import type { Movie } from "@/lib/types";

type Tab = "watchlist" | "watched" | "discover";

export default function MoviesPage() {
  const mounted = useMounted();
  const {
    movieWatchlist,
    moviesWatched,
    toggleMovieWatchlist,
    toggleMovieWatched,
  } = useTrack();
  const [tab, setTab] = useState<Tab>("watchlist");

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Films</h1>
        <p className="page-sub">Votre cinémathèque</p>
      </main>
    );
  }

  const lists: Record<Tab, Movie[]> = {
    watchlist: MOVIES.filter((m) => movieWatchlist.includes(m.id)),
    watched: MOVIES.filter((m) => moviesWatched.includes(m.id)),
    discover: MOVIES.filter(
      (m) => !movieWatchlist.includes(m.id) && !moviesWatched.includes(m.id)
    ),
  };
  const current = lists[tab];

  const emptyText: Record<Tab, string> = {
    watchlist: "Aucun film dans votre liste. Parcourez l'onglet Découvrir !",
    watched: "Vous n'avez encore marqué aucun film comme vu.",
    discover: "Vous avez déjà trié tous les films du catalogue 🎉",
  };

  return (
    <main className="page">
      <h1 className="page-title">Films</h1>
      <p className="page-sub">Votre cinémathèque</p>

      <div className="glass segmented" style={{ marginBottom: 20 }}>
        <button
          className={tab === "watchlist" ? "active" : ""}
          onClick={() => setTab("watchlist")}
        >
          À voir · {lists.watchlist.length}
        </button>
        <button
          className={tab === "watched" ? "active" : ""}
          onClick={() => setTab("watched")}
        >
          Vus · {lists.watched.length}
        </button>
        <button
          className={tab === "discover" ? "active" : ""}
          onClick={() => setTab("discover")}
        >
          Découvrir
        </button>
      </div>

      {current.length === 0 ? (
        <div className="glass empty">
          <div className="big">🎬</div>
          <p className="muted">{emptyText[tab]}</p>
        </div>
      ) : (
        <div className="stack">
          {current.map((m) => {
            const inList = movieWatchlist.includes(m.id);
            const seen = moviesWatched.includes(m.id);
            return (
              <div key={m.id} className="glass card row">
                <Poster emoji={m.emoji} colors={m.colors} mini />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>
                    {m.title}
                  </div>
                  <div className="muted" style={{ marginTop: 2 }}>
                    {m.year} · {minutesHuman(m.runtime)} · ★ {m.rating.toFixed(1)}
                  </div>
                  <div className="tiny" style={{ marginTop: 2 }}>
                    {m.genres.join(" · ")}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {!seen && (
                    <button
                      className={`check small${inList ? " checked" : ""}`}
                      aria-label="Liste à voir"
                      title="À voir"
                      onClick={() => toggleMovieWatchlist(m.id)}
                    >
                      {inList ? "✓" : "+"}
                    </button>
                  )}
                  <button
                    className={`check${seen ? " checked" : ""}`}
                    aria-label="Marquer comme vu"
                    title="Vu"
                    onClick={() => toggleMovieWatched(m.id)}
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
