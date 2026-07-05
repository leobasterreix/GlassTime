"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Poster from "@/components/Poster";
import { useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import { allEpisodes, epKey, epLabel, fmtRelativeOrDate } from "@/lib/utils";
import type { Episode, Show } from "@/lib/types";

type HistoryCard =
  | { kind: "episode"; key: string; date: string | null; show: Show; ep: Episode }
  | { kind: "movie"; key: string; date: string | null; title: string; poster?: string | null; movieId: number }
  | { kind: "book"; key: string; date: string | null; title: string; poster?: string | null; bookId: string };

export default function HistoryPage() {
  const router = useRouter();
  const mounted = useMounted();
  const {
    watched,
    showCache,
    movieWatchlist,
    moviesWatched,
    movieCache,
    booksRead,
    bookCache,
    episodeWatchedAt,
    moviesWatchedDates,
    booksReadDates,
  } = useTrack();
  useHydrateLibrary();

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Historique</h1>
        <div className="stack">
          <div className="skeleton" style={{ height: 76 }} />
          <div className="skeleton" style={{ height: 76 }} />
          <div className="skeleton" style={{ height: 76 }} />
        </div>
      </main>
    );
  }

  // Tous les épisodes déjà marqués vus, pas seulement ceux marqués depuis
  // l'ajout de l'horodatage — la date reste inconnue pour les plus anciens,
  // mais ils comptent quand même comme « vus » et doivent apparaître.
  const episodeCards: HistoryCard[] = Object.keys(watched).flatMap((showIdStr) => {
    const show = showCache[Number(showIdStr)];
    if (!show) return [];
    return allEpisodes(show)
      .filter((ep) => watched[show.id]?.[epKey(ep.s, ep.e)])
      .map((ep): HistoryCard => ({
        kind: "episode",
        key: `ep-${show.id}-${ep.s}:${ep.e}`,
        date: episodeWatchedAt[`${show.id}:${ep.s}:${ep.e}`] ?? null,
        show,
        ep,
      }));
  });

  const movieCards: HistoryCard[] = moviesWatched
    .map((id): HistoryCard | null => {
      const movie = movieCache[id];
      if (!movie) return null;
      return {
        kind: "movie",
        key: `movie-${id}`,
        date: moviesWatchedDates[id] ?? null,
        title: movie.title,
        poster: movie.poster,
        movieId: movie.id,
      };
    })
    .filter((x): x is HistoryCard => x !== null);

  const bookCards: HistoryCard[] = booksRead
    .map((id): HistoryCard | null => {
      const book = bookCache[id];
      if (!book) return null;
      return {
        kind: "book",
        key: `book-${id}`,
        date: booksReadDates[id] ?? null,
        title: book.title,
        poster: book.poster,
        bookId: book.id,
      };
    })
    .filter((x): x is HistoryCard => x !== null);

  // Date connue d'abord (plus récent en premier), puis le reste dans l'ordre
  // où on les a construits (par série, dans l'ordre des épisodes) — à défaut
  // de date, c'est le meilleur ordre disponible.
  const history = [...episodeCards, ...movieCards, ...bookCards].sort((a, b) => {
    if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return 0;
  });

  return (
    <main className="page">
      <Link href="/profile" className="chip pressable" style={{ marginBottom: 16, display: "inline-block" }}>
        ← Retour
      </Link>
      <h1 className="page-title">Historique</h1>
      <p className="page-sub">
        {history.length} élément{history.length > 1 ? "s" : ""}
      </p>

      {history.length === 0 ? (
        <div className="glass empty">
          <div className="big">📜</div>
          <p className="muted">
            Rien de vu ou lu pour le moment.
          </p>
        </div>
      ) : (
        <div className="stack">
          {history.map((card) => {
            if (card.kind === "episode") {
              return (
                <div
                  key={card.key}
                  className="glass agenda-card pressable"
                  onClick={() => router.push(`/show/${card.show.id}`)}
                >
                  <Poster item={card.show} mini />
                  <div className="agenda-body">
                    <div style={{ fontWeight: 700, fontSize: 15.5 }}>{card.show.title}</div>
                    <div className="muted" style={{ marginTop: 2 }}>
                      {epLabel(card.ep)} — {card.ep.title}
                    </div>
                  </div>
                  {card.date && <span className="badge-pill">{fmtRelativeOrDate(card.date)}</span>}
                </div>
              );
            }
            if (card.kind === "movie") {
              return (
                <div
                  key={card.key}
                  className="glass agenda-card pressable"
                  onClick={() => router.push(`/movie/${card.movieId}`)}
                >
                  <Poster item={{ title: card.title, poster: card.poster }} mini />
                  <div className="agenda-body">
                    <div style={{ fontWeight: 700, fontSize: 15.5 }}>{card.title}</div>
                    <div className="muted" style={{ marginTop: 2 }}>🎬 Film vu</div>
                  </div>
                  {card.date && <span className="badge-pill">{fmtRelativeOrDate(card.date)}</span>}
                </div>
              );
            }
            return (
              <div
                key={card.key}
                className="glass agenda-card pressable"
                onClick={() => router.push(`/book/${card.bookId}`)}
              >
                <Poster item={{ title: card.title, poster: card.poster }} mini />
                <div className="agenda-body">
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>{card.title}</div>
                  <div className="muted" style={{ marginTop: 2 }}>📚 Livre lu</div>
                </div>
                {card.date && <span className="badge-pill">{fmtRelativeOrDate(card.date)}</span>}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
