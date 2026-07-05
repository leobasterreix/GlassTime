"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Poster from "@/components/Poster";
import SwipeableRow from "@/components/SwipeableRow";
import { apiGet, useHydrateLibrary } from "@/lib/client";
import { notifyTodayEpisodes, updateAppBadge } from "@/lib/notifications";
import { useMounted, useTrack } from "@/lib/store";
import { markEpisodeWatched } from "@/lib/watch";
import { toast } from "@/lib/toast";
import {
  airedEpisodes,
  allEpisodes,
  bookStatus,
  DAY,
  effectiveShowStatus,
  epKey,
  epLabel,
  fmtRelative,
  fmtRelativeOrDateWithTime,
  fmtRelativeWithTime,
  movieStatus,
  nextEpisode,
  watchedCount,
} from "@/lib/utils";
import type { Book, Episode, Movie, Show } from "@/lib/types";

type UpcomingCard =
  | { kind: "upcoming-ep"; key: string; date: string; show: Show; ep: Episode }
  | { kind: "upcoming-movie"; key: string; date: string; movie: Movie };

type CatchupCard =
  | { kind: "catchup-show"; key: string; show: Show; ep: Episode }
  | { kind: "catchup-movie"; key: string; movie: Movie }
  | { kind: "catchup-book"; key: string; book: Book };

type HistoryCard =
  | { kind: "history-ep"; key: string; date: string | null; show: Show; ep: Episode }
  | { kind: "history-movie"; key: string; date: string | null; movie: Movie }
  | { kind: "history-book"; key: string; date: string | null; book: Book };

const STALE_DAYS = 60;

export default function AgendaPage() {
  const router = useRouter();
  const mounted = useMounted();
  const [tab, setTab] = useState<"rattraper" | "prochaines" | "historique">("rattraper");
  const {
    followed,
    watched,
    lastWatchedAt,
    episodeWatchedAt,
    showCache,
    movieWatchlist,
    moviesWatched,
    moviesWatchedDates,
    movieCache,
    booksWatchlist,
    booksRead,
    booksReadDates,
    bookCache,
    showStatus,
    pushNotification,
    setShowStatus,
    toggleMovieWatchlist,
    toggleMovieWatched,
    toggleBookWatchlist,
    toggleBookRead,
  } = useTrack();
  useHydrateLibrary();

  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const shows = mounted
    ? followed.map((id) => showCache[id]).filter(Boolean)
    : [];

  const activeShows = shows.filter(
    (s) => (showStatus[s.id] ?? "active") === "active"
  );
  const agendaShows = shows.filter(
    (s) => (showStatus[s.id] ?? "active") !== "dropped"
  );
  const loadingCount = mounted ? followed.length - shows.length : 0;

  // La série la plus récemment marquée remonte en tête : pouvoir enchaîner
  // les épisodes d'une série en swipant sans avoir à re-scroller jusqu'à sa
  // position d'origine à chaque fois. Les séries jamais marquées gardent
  // leur ordre d'origine entre elles (tri stable).
  const toCatchUp = activeShows
    .map((show) => ({ show, next: nextEpisode(show, watched[show.id]) }))
    .filter((x): x is { show: Show; next: Episode } => x.next !== null)
    .sort((a, b) => {
      const ta = lastWatchedAt[a.show.id] ? new Date(lastWatchedAt[a.show.id]).getTime() : 0;
      const tb = lastWatchedAt[b.show.id] ? new Date(lastWatchedAt[b.show.id]).getTime() : 0;
      return tb - ta;
    });

  // Films de la liste "à voir" déjà sortis (pas encore vus) et livres de la
  // liste "à lire" : autant d'éléments "à rattraper" au même titre que les
  // épisodes de séries.
  const nowTs = Date.now();
  const moviesToCatchUp = mounted
    ? movieWatchlist
        .map((id) => movieCache[id])
        .filter(
          (m): m is Movie =>
            !!m && !moviesWatched.includes(m.id) && (!m.releaseDate || new Date(m.releaseDate).getTime() <= nowTs)
        )
    : [];
  const booksToCatchUp = mounted
    ? booksWatchlist.map((id) => bookCache[id]).filter((b): b is Book => !!b)
    : [];

  const pendingEpisodes = activeShows.reduce(
    (acc, s) =>
      acc +
      Math.max(0, airedEpisodes(s).length - watchedCount(s, watched[s.id])),
    0
  );

  const catchupCards: CatchupCard[] = [
    ...toCatchUp.map(
      ({ show, next }): CatchupCard => ({
        kind: "catchup-show",
        key: `catchup-${show.id}-${next.s}:${next.e}`,
        show,
        ep: next,
      })
    ),
    ...moviesToCatchUp.map(
      (movie): CatchupCard => ({ kind: "catchup-movie", key: `catchup-movie-${movie.id}`, movie })
    ),
    ...booksToCatchUp.map(
      (book): CatchupCard => ({ kind: "catchup-book", key: `catchup-book-${book.id}`, book })
    ),
  ];

  // Prochaines diffusions : épisodes des séries suivies + sorties des films à
  // voir, sans limite de date (on affiche tout ce qui est programmé).
  const now = Date.now();

  const epEntries = agendaShows
    .flatMap((show) =>
      allEpisodes(show)
        .filter((ep) => ep.airDate)
        .map((ep) => ({ show, ep, date: ep.airDate! }))
    )
    .filter(({ date }) => new Date(date).getTime() > now);

  const movieEntries = mounted
    ? movieWatchlist
        .map((id) => movieCache[id])
        .filter((m): m is Movie => !!m?.releaseDate)
        .filter((m) => new Date(m.releaseDate!).getTime() > now)
        .map((m) => ({ movie: m, date: m.releaseDate! }))
    : [];

  const upcomingCards: UpcomingCard[] = [
    ...epEntries.map(
      ({ show, ep, date }): UpcomingCard => ({
        kind: "upcoming-ep",
        key: `ep-${show.id}-${ep.s}:${ep.e}`,
        date,
        show,
        ep,
      })
    ),
    ...movieEntries.map(
      ({ movie, date }): UpcomingCard => ({
        kind: "upcoming-movie",
        key: `movie-${movie.id}`,
        date,
        movie,
      })
    ),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Historique : tout ce qui a déjà été vu/lu, pas seulement ce qui a été
  // marqué depuis l'ajout de l'horodatage — la date reste inconnue pour les
  // plus anciens (pas de badge), mais ils comptent quand même comme « vus »
  // et doivent apparaître.
  const historyEpisodeCards: HistoryCard[] = Object.keys(watched).flatMap((showIdStr) => {
    const show = showCache[Number(showIdStr)];
    if (!show) return [];
    return allEpisodes(show)
      .filter((ep) => watched[show.id]?.[epKey(ep.s, ep.e)])
      .map((ep): HistoryCard => ({
        kind: "history-ep",
        key: `hist-ep-${show.id}-${ep.s}:${ep.e}`,
        date: episodeWatchedAt[`${show.id}:${ep.s}:${ep.e}`] ?? null,
        show,
        ep,
      }));
  });
  const historyMovieCards: HistoryCard[] = moviesWatched
    .map((id): HistoryCard | null => {
      const movie = movieCache[id];
      if (!movie) return null;
      return { kind: "history-movie", key: `hist-movie-${id}`, date: moviesWatchedDates[id] ?? null, movie };
    })
    .filter((x): x is HistoryCard => x !== null);
  const historyBookCards: HistoryCard[] = booksRead
    .map((id): HistoryCard | null => {
      const book = bookCache[id];
      if (!book) return null;
      return { kind: "history-book", key: `hist-book-${id}`, date: booksReadDates[id] ?? null, book };
    })
    .filter((x): x is HistoryCard => x !== null);
  // Date connue d'abord (plus récent en premier), puis le reste dans l'ordre
  // de construction (par série, dans l'ordre des épisodes) à défaut de mieux.
  const historyCards = [...historyEpisodeCards, ...historyMovieCards, ...historyBookCards].sort(
    (a, b) => {
      if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return 0;
    }
  );

  /** Statuts de suivi affichés sur les cartes à rattraper : jamais commencée,
   * ou plus touchée depuis longtemps (delaissée sans être abandonnée). */
  function catchupBadge(show: Show): { emoji: string; label: string } | null {
    const seen = watchedCount(show, watched[show.id]);
    if (seen === 0) return { emoji: "🆕", label: "Pas commencé" };
    const last = lastWatchedAt[show.id];
    if (last) {
      const days = Math.floor((Date.now() - new Date(last).getTime()) / DAY);
      if (days >= STALE_DAYS) return { emoji: "⏳", label: `Pas vu depuis ${days} j` };
    }
    return null;
  }

  /** Swipe gauche : abandonne la série (statut « dropped ») sans la retirer
   * du suivi — elle disparaît juste de l'agenda, contrairement à un
   * désabonnement complet. */
  function dropShow(show: Show) {
    setShowStatus(show.id, "dropped");
    toast(`${show.title} marquée comme abandonnée`, "🏳️");
  }

  function markMovieDone(m: Movie) {
    toggleMovieWatched(m.id);
    toast(`${m.title} vu !`, "🎬");
  }

  function removeMovieFromWatchlist(m: Movie) {
    toggleMovieWatchlist(m.id);
    toast(`${m.title} retiré de la liste à voir`, "🗑");
  }

  function markBookDone(b: Book) {
    toggleBookRead(b.id);
    toast(`${b.title} lu !`, "📖");
  }

  function removeBookFromWatchlist(b: Book) {
    toggleBookWatchlist(b.id);
    toast(`${b.title} retiré de la liste à lire`, "🗑");
  }

  const agendaShowIds = agendaShows.map((s) => s.id).join(",");

  // Rafraîchit les horaires réels (Trakt) des séries déjà en cache : celles
  // suivies avant l'ajout de cette fonctionnalité n'ont que la date TMDB,
  // sans heure — ce fetch les met à niveau sans attendre une revisite de
  // leur fiche complète.
  useEffect(() => {
    if (!mounted || !agendaShowIds) return;
    apiGet<Record<number, Record<string, string>>>(
      `/api/shows/air-times?ids=${agendaShowIds}`
    ).then((data) => {
      if (!data) return;
      for (const show of agendaShows) {
        const times = data[show.id];
        if (!times || !show.seasons) continue;
        useTrack.getState().cacheShow({
          ...show,
          seasons: show.seasons.map((season) => ({
            ...season,
            episodes: season.episodes.map((ep) => {
              const t = times[epKey(ep.s, ep.e)];
              return t ? { ...ep, airDate: t } : ep;
            }),
          })),
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, agendaShowIds]);

  useEffect(() => {
    if (!mounted) return;
    updateAppBadge(pendingEpisodes);
    const todayStr = new Date().toISOString().slice(0, 10);
    const airingToday = agendaShows.flatMap((show) =>
      allEpisodes(show)
        .filter((ep) => ep.airDate?.slice(0, 10) === todayStr)
        .map((ep) => ({ show, ep }))
    );
    notifyTodayEpisodes(airingToday);
    for (const { show, ep } of airingToday) {
      pushNotification({
        id: `ep-${show.id}-${ep.s}:${ep.e}`,
        message: `${show.title} — ${epLabel(ep)} disponible aujourd'hui`,
        emoji: "📺",
        href: `/show/${show.id}`,
      });
    }
    const moviesToday = movieWatchlist
      .map((id) => movieCache[id])
      .filter((m): m is Movie => !!m?.releaseDate && m.releaseDate.slice(0, 10) === todayStr);
    for (const m of moviesToday) {
      pushNotification({
        id: `movie-${m.id}`,
        message: `${m.title} — sortie aujourd'hui`,
        emoji: "🎬",
        href: `/movie/${m.id}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, pendingEpisodes]);

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Agenda</h1>
        <p className="page-sub">{today}</p>
        <div className="stack">
          <div className="skeleton" style={{ height: 76 }} />
          <div className="skeleton" style={{ height: 76 }} />
          <div className="skeleton" style={{ height: 76 }} />
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <h1 className="page-title">Agenda</h1>
      <p className="page-sub">{today}</p>

      {followed.length === 0 ? (
        <div className="glass empty">
          <div className="big">📺</div>
          <h2 style={{ fontSize: 19, marginBottom: 8 }}>Aucune série suivie</h2>
          <p className="muted" style={{ marginBottom: 18 }}>
            Ajoutez vos séries préférées pour retrouver ici les épisodes à voir
            et les prochaines diffusions.
          </p>
          <Link href="/discover" className="btn btn-primary pressable">
            Découvrir des séries
          </Link>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 20 }}>
            <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {pendingEpisodes}
              </div>
              <div className="tiny">
                épisode{pendingEpisodes > 1 ? "s" : ""} à rattraper
              </div>
            </div>
            <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {followed.length}
              </div>
              <div className="tiny">
                série{followed.length > 1 ? "s" : ""} suivie
                {followed.length > 1 ? "s" : ""}
              </div>
            </div>
          </div>

          <p className="tiny" style={{ marginBottom: 16, color: "var(--text-3)" }}>
            Glissez une carte à droite pour marquer vu, à gauche pour abandonner la série.
          </p>

          {loadingCount > 0 && (
            <div className="stack" style={{ marginBottom: 20 }}>
              {Array.from({ length: Math.min(loadingCount, 3) }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 76 }} />
              ))}
            </div>
          )}

          <div className="glass segmented" style={{ marginBottom: 16 }}>
            <button className={tab === "rattraper" ? "active" : ""} onClick={() => setTab("rattraper")}>
              À rattraper{catchupCards.length > 0 ? ` · ${catchupCards.length}` : ""}
            </button>
            <button className={tab === "prochaines" ? "active" : ""} onClick={() => setTab("prochaines")}>
              Prochaines diffusions{upcomingCards.length > 0 ? ` · ${upcomingCards.length}` : ""}
            </button>
            <button className={tab === "historique" ? "active" : ""} onClick={() => setTab("historique")}>
              Historique{historyCards.length > 0 ? ` · ${historyCards.length}` : ""}
            </button>
          </div>

          {tab === "rattraper" && (catchupCards.length === 0 ? (
            <div className="glass card" style={{ textAlign: "center", marginBottom: 20 }}>
              <span className="muted">Tout est rattrapé, bravo !</span>
            </div>
          ) : (
            <div className="stack" style={{ marginBottom: 20 }}>
              {catchupCards.map((card) => {
                if (card.kind === "catchup-show") {
                  const { show, ep } = card;
                  const badge = catchupBadge(show);
                  return (
                    <SwipeableRow
                      key={card.key}
                      onTap={() => router.push(`/show/${show.id}`)}
                      onSwipeRight={() => markEpisodeWatched(show, ep)}
                      onSwipeLeft={() => dropShow(show)}
                      leftIcon="🏳️"
                    >
                      <div className="glass agenda-card pressable">
                        <Poster
                          item={{ ...show, status: effectiveShowStatus(show, showStatus[show.id]) }}
                          mini
                        />
                        <div className="agenda-body">
                          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 700, fontSize: 15.5 }}>{show.title}</div>
                            {badge && (
                              <span className="agenda-status-pill">
                                {badge.emoji} {badge.label}
                              </span>
                            )}
                          </div>
                          <div className="muted" style={{ marginTop: 2 }}>
                            {epLabel(ep)} — {ep.title}
                          </div>
                          <div className="tiny" style={{ marginTop: 2 }}>
                            diffusé {fmtRelativeOrDateWithTime(ep.airDate!)}
                          </div>
                        </div>
                        <button
                          className="check"
                          aria-label={`Marquer ${epLabel(ep)} comme vu`}
                          onClick={(e) => {
                            e.stopPropagation();
                            markEpisodeWatched(show, ep);
                          }}
                        >
                          ✓
                        </button>
                      </div>
                    </SwipeableRow>
                  );
                }
                if (card.kind === "catchup-movie") {
                  const { movie } = card;
                  return (
                    <SwipeableRow
                      key={card.key}
                      onTap={() => router.push(`/movie/${movie.id}`)}
                      onSwipeRight={() => markMovieDone(movie)}
                      onSwipeLeft={() => removeMovieFromWatchlist(movie)}
                    >
                      <div className="glass agenda-card pressable">
                        <Poster item={{ ...movie, status: movieStatus(true, false) }} mini />
                        <div className="agenda-body">
                          <div style={{ fontWeight: 700, fontSize: 15.5 }}>{movie.title}</div>
                          <div className="muted" style={{ marginTop: 2 }}>🎬 Film à voir</div>
                        </div>
                        <button
                          className="check"
                          aria-label={`Marquer ${movie.title} comme vu`}
                          onClick={(e) => {
                            e.stopPropagation();
                            markMovieDone(movie);
                          }}
                        >
                          ✓
                        </button>
                      </div>
                    </SwipeableRow>
                  );
                }
                const { book } = card;
                return (
                  <SwipeableRow
                    key={card.key}
                    onTap={() => router.push(`/book/${book.id}`)}
                    onSwipeRight={() => markBookDone(book)}
                    onSwipeLeft={() => removeBookFromWatchlist(book)}
                  >
                    <div className="glass agenda-card pressable">
                      <Poster item={{ ...book, status: bookStatus(true, false) }} mini />
                      <div className="agenda-body">
                        <div style={{ fontWeight: 700, fontSize: 15.5 }}>{book.title}</div>
                        <div className="muted" style={{ marginTop: 2 }}>📚 Livre à lire</div>
                      </div>
                      <button
                        className="check"
                        aria-label={`Marquer ${book.title} comme lu`}
                        onClick={(e) => {
                          e.stopPropagation();
                          markBookDone(book);
                        }}
                      >
                        ✓
                      </button>
                    </div>
                  </SwipeableRow>
                );
              })}
            </div>
          ))}

          {tab === "prochaines" && (upcomingCards.length === 0 ? (
            <div className="glass card" style={{ textAlign: "center" }}>
              <span className="muted">Aucune diffusion prévue pour le moment.</span>
            </div>
          ) : (
            <div className="stack">
              {upcomingCards.map((card) =>
                card.kind === "upcoming-ep" ? (
                  <SwipeableRow
                    key={card.key}
                    onTap={() => router.push(`/show/${card.show.id}`)}
                    onSwipeLeft={() => dropShow(card.show)}
                    leftIcon="🏳️"
                  >
                    <div className="glass agenda-card pressable">
                      <Poster
                        item={{
                          ...card.show,
                          status: effectiveShowStatus(card.show, showStatus[card.show.id]),
                        }}
                        mini
                      />
                      <div className="agenda-body">
                        <div style={{ fontWeight: 700, fontSize: 15.5 }}>{card.show.title}</div>
                        <div className="muted" style={{ marginTop: 2 }}>
                          {epLabel(card.ep)} — {card.ep.title}
                        </div>
                      </div>
                      <span className="badge-pill">{fmtRelativeWithTime(card.date)}</span>
                    </div>
                  </SwipeableRow>
                ) : (
                  <SwipeableRow
                    key={card.key}
                    onTap={() => router.push(`/movie/${card.movie.id}`)}
                    onSwipeLeft={() => toggleMovieWatchlist(card.movie.id)}
                  >
                    <div className="glass agenda-card pressable">
                      <Poster item={{ ...card.movie, status: movieStatus(true, false) }} mini />
                      <div className="agenda-body">
                        <div style={{ fontWeight: 700, fontSize: 15.5 }}>{card.movie.title}</div>
                        <div className="muted" style={{ marginTop: 2 }}>🎬 Sortie du film</div>
                      </div>
                      <span className="badge-pill">{fmtRelative(card.date)}</span>
                    </div>
                  </SwipeableRow>
                )
              )}
            </div>
          ))}

          {tab === "historique" && (historyCards.length === 0 ? (
            <div className="glass card" style={{ textAlign: "center" }}>
              <span className="muted">Rien de vu ou lu pour le moment.</span>
            </div>
          ) : (
            <div className="stack">
              {historyCards.map((card) => {
                if (card.kind === "history-ep") {
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
                      {card.date && <span className="badge-pill">{fmtRelativeOrDateWithTime(card.date)}</span>}
                    </div>
                  );
                }
                if (card.kind === "history-movie") {
                  return (
                    <div
                      key={card.key}
                      className="glass agenda-card pressable"
                      onClick={() => router.push(`/movie/${card.movie.id}`)}
                    >
                      <Poster item={card.movie} mini />
                      <div className="agenda-body">
                        <div style={{ fontWeight: 700, fontSize: 15.5 }}>{card.movie.title}</div>
                        <div className="muted" style={{ marginTop: 2 }}>🎬 Film vu</div>
                      </div>
                      {card.date && <span className="badge-pill">{fmtRelativeOrDateWithTime(card.date)}</span>}
                    </div>
                  );
                }
                return (
                  <div
                    key={card.key}
                    className="glass agenda-card pressable"
                    onClick={() => router.push(`/book/${card.book.id}`)}
                  >
                    <Poster item={card.book} mini />
                    <div className="agenda-body">
                      <div style={{ fontWeight: 700, fontSize: 15.5 }}>{card.book.title}</div>
                      <div className="muted" style={{ marginTop: 2 }}>📚 Livre lu</div>
                    </div>
                    {card.date && <span className="badge-pill">{fmtRelativeOrDateWithTime(card.date)}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}
    </main>
  );
}
