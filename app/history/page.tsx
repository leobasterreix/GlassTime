"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Poster from "@/components/Poster";
import { useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import { allEpisodes, epLabel, fmtRelativeOrDate } from "@/lib/utils";
import type { Episode, Show } from "@/lib/types";

type HistoryCard =
  | { kind: "episode"; key: string; date: string; show: Show; ep: Episode }
  | { kind: "movie"; key: string; date: string; title: string; poster?: string | null; movieId: number }
  | { kind: "book"; key: string; date: string; title: string; poster?: string | null; bookId: string };

export default function HistoryPage() {
  const router = useRouter();
  const mounted = useMounted();
  const { showCache, movieCache, bookCache, episodeWatchedAt, moviesWatchedDates, booksReadDates } =
    useTrack();
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

  const episodeCards: HistoryCard[] = Object.entries(episodeWatchedAt)
    .map(([key, date]) => {
      const [showIdStr, sStr, eStr] = key.split(":");
      const show = showCache[Number(showIdStr)];
      if (!show) return null;
      const ep = allEpisodes(show).find(
        (x) => x.s === Number(sStr) && x.e === Number(eStr)
      );
      if (!ep) return null;
      return { kind: "episode", key: `ep-${key}`, date, show, ep } as HistoryCard;
    })
    .filter((x): x is HistoryCard => x !== null);

  const movieCards: HistoryCard[] = Object.entries(moviesWatchedDates)
    .map(([id, date]) => {
      const movie = movieCache[Number(id)];
      if (!movie) return null;
      return {
        kind: "movie",
        key: `movie-${id}`,
        date,
        title: movie.title,
        poster: movie.poster,
        movieId: movie.id,
      } as HistoryCard;
    })
    .filter((x): x is HistoryCard => x !== null);

  const bookCards: HistoryCard[] = Object.entries(booksReadDates)
    .map(([id, date]) => {
      const book = bookCache[id];
      if (!book) return null;
      return {
        kind: "book",
        key: `book-${id}`,
        date,
        title: book.title,
        poster: book.poster,
        bookId: book.id,
      } as HistoryCard;
    })
    .filter((x): x is HistoryCard => x !== null);

  const history = [...episodeCards, ...movieCards, ...bookCards].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

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
            Rien pour le moment — l'historique se remplit à partir de vos
            prochains marquages (les épisodes déjà vus avant cette
            fonctionnalité n'ont pas de date connue).
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
                  <span className="badge-pill">{fmtRelativeOrDate(card.date)}</span>
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
                  <span className="badge-pill">{fmtRelativeOrDate(card.date)}</span>
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
                <span className="badge-pill">{fmtRelativeOrDate(card.date)}</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
