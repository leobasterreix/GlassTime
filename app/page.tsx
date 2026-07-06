"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  fmtRelativeOrDateWithTime,
  movieStatus,
  nextEpisode,
  watchedCount,
} from "@/lib/utils";
import type { Book, Episode, Movie, Show } from "@/lib/types";

type HistoryCard =
  | { kind: "history-ep"; key: string; date: string | null; show: Show; ep: Episode }
  | { kind: "history-movie"; key: string; date: string | null; movie: Movie }
  | { kind: "history-book"; key: string; date: string | null; book: Book };

const STALE_DAYS = 60;

// Évite l'avertissement useLayoutEffect côté serveur tout en gardant un
// ancrage de scroll sans clignotement côté client.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function AgendaPage() {
  const router = useRouter();
  const mounted = useMounted();
  const [category, setCategory] = useState<"series" | "movies" | "books">("series");
  const headerRef = useRef<HTMLDivElement>(null);
  const catchupDividerRef = useRef<HTMLHeadingElement>(null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editPageVal, setEditPageVal] = useState<number>(0);
  const [editTotalVal, setEditTotalVal] = useState<number>(300);

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
    bookProgress,
    updateBookProgress,
    setEpisode,
  } = useTrack();
  useHydrateLibrary();

  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const shows = useMemo(
    () => (mounted ? followed.map((id) => showCache[id]).filter(Boolean) : []),
    [mounted, followed, showCache]
  ) as Show[];

  const activeShows = useMemo(
    () => shows.filter((s) => (showStatus[s.id] ?? "active") === "active"),
    [shows, showStatus]
  );
  const agendaShows = useMemo(
    () => shows.filter((s) => (showStatus[s.id] ?? "active") !== "dropped"),
    [shows, showStatus]
  );
  const loadingMovies = mounted
    ? movieWatchlist.filter((id) => !movieCache[id]).length
    : 0;
  const loadingBooks = mounted
    ? booksWatchlist.filter((id) => !bookCache[id]).length
    : 0;
  const loadingCount =
    category === "series"
      ? (mounted ? followed.length - shows.length : 0)
      : category === "movies"
      ? loadingMovies
      : loadingBooks;

  // La série la plus récemment marquée remonte en tête : pouvoir enchaîner
  // les épisodes d'une série en swipant sans avoir à re-scroller jusqu'à sa
  // position d'origine à chaque fois. Les séries jamais marquées gardent
  // leur ordre d'origine entre elles (tri stable).
  const toCatchUp = useMemo(
    () =>
      activeShows
        .map((show) => ({ show, next: nextEpisode(show, watched[show.id]) }))
        .filter((x): x is { show: Show; next: Episode } => x.next !== null)
        .sort((a, b) => {
          const ta = lastWatchedAt[a.show.id] ? new Date(lastWatchedAt[a.show.id]).getTime() : 0;
          const tb = lastWatchedAt[b.show.id] ? new Date(lastWatchedAt[b.show.id]).getTime() : 0;
          return tb - ta;
        }),
    [activeShows, watched, lastWatchedAt]
  );

  // Films de la liste "à voir" déjà sortis (pas encore vus) et livres de la
  // liste "à lire" : autant d'éléments "à rattraper" au même titre que les
  // épisodes de séries.
  const moviesToCatchUp = useMemo(
    () =>
      mounted
        ? movieWatchlist
            .map((id) => movieCache[id])
            .filter(
              (m): m is Movie =>
                !!m && !moviesWatched.includes(m.id) && (!m.releaseDate || new Date(m.releaseDate).getTime() <= Date.now())
            )
        : [],
    [mounted, movieWatchlist, movieCache, moviesWatched]
  );
  const booksToCatchUp = useMemo(
    () => (mounted ? booksWatchlist.map((id) => bookCache[id]).filter((b): b is Book => !!b) : []),
    [mounted, booksWatchlist, bookCache]
  );

  const pendingEpisodes = useMemo(
    () =>
      activeShows.reduce(
        (acc, s) => acc + Math.max(0, airedEpisodes(s).length - watchedCount(s, watched[s.id])),
        0
      ),
    [activeShows, watched]
  );

  // Les « prochaines diffusions » et « prochaines sorties » ont leur propre
  // onglet dédié (« Avenir », /upcoming) — l'agenda ne montre plus que le
  // passé (historique) et le présent (à rattraper / à voir / à lire).

  // Historique : tout ce qui a déjà été vu/lu, pas seulement ce qui a été
  // marqué depuis l'ajout de l'horodatage — la date reste inconnue pour les
  // plus anciens (pas de badge), mais ils comptent quand même comme « vus »
  // et doivent apparaître.
  // Tri par date décroissante puis inversé (ordre chronologique ascendant),
  // les éléments sans date restant en fin. Facteur commun aux trois historiques.
  const byDateThenReverse = (cards: HistoryCard[]) =>
    [...cards]
      .sort((a, b) => {
        if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (a.date && !b.date) return -1;
        if (!a.date && b.date) return 1;
        return 0;
      })
      .reverse();

  // Historiques séparés par type de média (TV Time style)
  const historyEpisodeAscending = useMemo(() => {
    const cards: HistoryCard[] = Object.keys(watched).flatMap((showIdStr) => {
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
    return byDateThenReverse(cards);
  }, [watched, showCache, episodeWatchedAt]);

  const historyMovieAscending = useMemo(() => {
    const cards: HistoryCard[] = moviesWatched
      .map((id): HistoryCard | null => {
        const movie = movieCache[id];
        if (!movie) return null;
        return { kind: "history-movie", key: `hist-movie-${id}`, date: moviesWatchedDates[id] ?? null, movie };
      })
      .filter((x): x is HistoryCard => x !== null);
    return byDateThenReverse(cards);
  }, [moviesWatched, movieCache, moviesWatchedDates]);

  const historyBookAscending = useMemo(() => {
    const cards: HistoryCard[] = booksRead
      .map((id): HistoryCard | null => {
        const book = bookCache[id];
        if (!book) return null;
        return { kind: "history-book", key: `hist-book-${id}`, date: booksReadDates[id] ?? null, book };
      })
      .filter((x): x is HistoryCard => x !== null);
    return byDateThenReverse(cards);
  }, [booksRead, bookCache, booksReadDates]);

  // La bande d'historique de l'agenda n'affiche que les N éléments les plus
  // récents (les listes sont triées en ordre ascendant, donc les plus récents
  // sont en fin) : le passé complet n'a pas à peser sur le chargement de la
  // page — c'est un aperçu, pas un journal exhaustif.
  const HISTORY_LIMIT = 10;
  const recentHistoryEp = historyEpisodeAscending.slice(-HISTORY_LIMIT);
  const recentHistoryMovie = historyMovieAscending.slice(-HISTORY_LIMIT);
  const recentHistoryBook = historyBookAscending.slice(-HISTORY_LIMIT);

  // Layout effect pour ancrer le scroll sous le header fixe
  useIsoLayoutEffect(() => {
    if (!mounted) return;
    const divider = catchupDividerRef.current;
    if (!divider) {
      window.scrollTo(0, 0);
      return;
    }
    const headerH = headerRef.current?.offsetHeight ?? 185;
    const target = Math.max(0, divider.offsetTop - headerH - 6);
    window.scrollTo(0, target);
  }, [mounted, category]);

  function renderHistoryCard(card: HistoryCard) {
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
          <button
            className="pressable"
            aria-label="Supprimer de l'historique"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Supprimer cet épisode de votre historique ?")) {
                setEpisode(card.show.id, card.ep.s, card.ep.e, false);
              }
            }}
            style={{
              padding: 6,
              marginLeft: 6,
              borderRadius: "50%",
              color: "var(--text-3)",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent"
            }}
          >
            ✕
          </button>
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
          <button
            className="pressable"
            aria-label="Supprimer de l'historique"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Supprimer ce film de votre historique ?")) {
                toggleMovieWatched(card.movie.id);
              }
            }}
            style={{
              padding: 6,
              marginLeft: 6,
              borderRadius: "50%",
              color: "var(--text-3)",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent"
            }}
          >
            ✕
          </button>
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
        <button
          className="pressable"
          aria-label="Supprimer de l'historique"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Supprimer ce livre de votre historique ?")) {
              toggleBookRead(card.book.id);
            }
          }}
          style={{
            padding: 6,
            marginLeft: 6,
            borderRadius: "50%",
            color: "var(--text-3)",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent"
          }}
        >
          ✕
        </button>
      </div>
    );
  }

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
    <main className="page" style={{ paddingTop: 0 }}>
      {/* En-tête collant (sticky) : Titre, Date, Onglets de Catégorie uniquement —
          plus de sous-onglets : chaque catégorie est un défilement continu
          unique (historique ← passé, à rattraper = maintenant, prochaines →
          futur), façon timeline. */}
      <div
        ref={headerRef}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--tab-bg)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: 12,
          borderBottom: "1px solid var(--hairline)",
          margin: "0 -18px 16px -18px",
          paddingLeft: 18,
          paddingRight: 18,
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: 28 }}>Agenda</h1>
            <p className="page-sub" style={{ margin: 0, marginTop: 2 }}>{today}</p>
          </div>
        </div>

        {/* Sélecteur de Catégorie : Séries | Films | Livres */}
        <div className="glass segmented" style={{ marginBottom: 0 }}>
          <button className={category === "series" ? "active" : ""} onClick={() => setCategory("series")}>
            Séries 📺
          </button>
          <button className={category === "movies" ? "active" : ""} onClick={() => setCategory("movies")}>
            Films 🎬
          </button>
          <button className={category === "books" ? "active" : ""} onClick={() => setCategory("books")}>
            Livres 📚
          </button>
        </div>
      </div>

      {/* États vides spécifiques par catégorie */}
      {category === "series" && followed.length === 0 && (
        <div className="glass empty">
          <div className="big">📺</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Aucune série suivie</h2>
          <p className="muted" style={{ marginBottom: 20, maxWidth: 320, marginInline: "auto", lineHeight: 1.5 }}>
            Ajoutez vos séries préférées pour suivre les épisodes à voir et les prochaines diffusions.
          </p>
          <Link
            href="/discover"
            className="btn btn-primary pressable"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 12, fontWeight: 700 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Découvrir des séries
          </Link>
        </div>
      )}

      {category === "movies" && movieWatchlist.length === 0 && (
        <div className="glass empty">
          <div className="big">🎬</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Aucun film à voir</h2>
          <p className="muted" style={{ marginBottom: 20, maxWidth: 320, marginInline: "auto", lineHeight: 1.5 }}>
            Créez votre watchlist et retrouvez ici vos films à voir et les prochaines sorties.
          </p>
          <Link
            href="/discover"
            className="btn btn-primary pressable"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 12, fontWeight: 700 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Découvrir des films
          </Link>
        </div>
      )}

      {category === "books" && booksWatchlist.length === 0 && (
        <div className="glass empty">
          <div className="big">📚</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Aucun livre à lire</h2>
          <p className="muted" style={{ marginBottom: 20, maxWidth: 320, marginInline: "auto", lineHeight: 1.5 }}>
            Ajoutez des livres à votre liste pour suivre votre progression de lecture.
          </p>
          <Link
            href="/discover"
            className="btn btn-primary pressable"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 12, fontWeight: 700 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Découvrir des livres
          </Link>
        </div>
      )}

      {/* Rendu des listes s'il y a du contenu */}
      {((category === "series" && followed.length > 0) ||
        (category === "movies" && movieWatchlist.length > 0) ||
        (category === "books" && booksWatchlist.length > 0)) && (
        <>
          {/* Ligne de statistiques dynamiques */}
          <div className="row" style={{ marginBottom: 20 }}>
            {category === "series" ? (
              <>
                <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{pendingEpisodes}</div>
                  <div className="tiny">épisode{pendingEpisodes > 1 ? "s" : ""} à rattraper</div>
                </div>
                <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{followed.length}</div>
                  <div className="tiny">série{followed.length > 1 ? "s" : ""} suivie{followed.length > 1 ? "s" : ""}</div>
                </div>
              </>
            ) : category === "movies" ? (
              <>
                <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{moviesToCatchUp.length}</div>
                  <div className="tiny">film{moviesToCatchUp.length > 1 ? "s" : ""} à voir</div>
                </div>
                <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{moviesWatched.length}</div>
                  <div className="tiny">film{moviesWatched.length > 1 ? "s" : ""} vu{moviesWatched.length > 1 ? "s" : ""}</div>
                </div>
              </>
            ) : (
              <>
                <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{booksToCatchUp.length}</div>
                  <div className="tiny">livre{booksToCatchUp.length > 1 ? "s" : ""} à lire</div>
                </div>
                <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{booksRead.length}</div>
                  <div className="tiny">livre{booksRead.length > 1 ? "s" : ""} lu{booksRead.length > 1 ? "s" : ""}</div>
                </div>
              </>
            )}
          </div>

          <p className="tiny" style={{ marginBottom: 16, color: "var(--text-3)" }}>
            {category === "series"
              ? "Glissez une carte à droite pour marquer vu, à gauche pour abandonner la série."
              : category === "movies"
              ? "Glissez une carte à droite pour marquer vu, à gauche pour retirer de la liste."
              : "Glissez une carte à droite pour marquer lu, à gauche pour retirer de la liste."}
          </p>

          {loadingCount > 0 && (
            <div className="stack" style={{ marginBottom: 20 }}>
              {Array.from({ length: Math.min(loadingCount, 3) }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 76 }} />
              ))}
            </div>
          )}

          {/* SECTION SÉRIES — un seul défilement continu : historique (↑
              passé), à rattraper (maintenant), prochaines diffusions (↓ futur) */}
          {category === "series" && (
            <>
              {historyEpisodeAscending.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p className="tiny" style={{ textAlign: "center", color: "var(--text-3)", marginBottom: 10 }}>
                    ↑ Historique de visionnage
                  </p>
                  <div className="stack">{recentHistoryEp.map(renderHistoryCard)}</div>
                </div>
              )}

              <h2 className="section-title" ref={catchupDividerRef} style={{ scrollMarginTop: 80 }}>
                À rattraper{toCatchUp.length > 0 && <small>{toCatchUp.length}</small>}
              </h2>

              {toCatchUp.length === 0 ? (
                <div className="glass card" style={{ textAlign: "center", marginBottom: 20 }}>
                  <span className="muted">Tout est rattrapé, bravo !</span>
                </div>
              ) : (
                <div className="stack" style={{ marginBottom: 20 }}>
                  {toCatchUp.map(({ show, next }) => {
                    const badge = catchupBadge(show);
                    return (
                      <SwipeableRow
                        key={`catchup-${show.id}-${next.s}:${next.e}`}
                        onTap={() => router.push(`/show/${show.id}`)}
                        onSwipeRight={() => markEpisodeWatched(show, next)}
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
                              {epLabel(next)} — {next.title}
                            </div>
                            <div className="tiny" style={{ marginTop: 2 }}>
                              diffusé {fmtRelativeOrDateWithTime(next.airDate!)}
                            </div>
                          </div>
                          <button
                            className="check"
                            aria-label={`Marquer ${epLabel(next)} comme vu`}
                            onClick={(e) => {
                              e.stopPropagation();
                              markEpisodeWatched(show, next);
                            }}
                          >
                            ✓
                          </button>
                        </div>
                      </SwipeableRow>
                    );
                  })}
                </div>
              )}

            </>
          )}

          {/* SECTION FILMS */}
          {category === "movies" && (
            <>
              {historyMovieAscending.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p className="tiny" style={{ textAlign: "center", color: "var(--text-3)", marginBottom: 10 }}>
                    ↑ Historique de visionnage
                  </p>
                  <div className="stack">{recentHistoryMovie.map(renderHistoryCard)}</div>
                </div>
              )}

              <h2 className="section-title" ref={catchupDividerRef} style={{ scrollMarginTop: 80 }}>
                À voir{moviesToCatchUp.length > 0 && <small>{moviesToCatchUp.length}</small>}
              </h2>

              {moviesToCatchUp.length === 0 ? (
                <div className="glass card" style={{ textAlign: "center", marginBottom: 20 }}>
                  <span className="muted">Aucun film à voir.</span>
                </div>
              ) : (
                <div className="stack" style={{ marginBottom: 20 }}>
                  {moviesToCatchUp.map((movie) => (
                    <SwipeableRow
                      key={`catchup-movie-${movie.id}`}
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
                  ))}
                </div>
              )}

            </>
          )}

          {/* SECTION LIVRES — pas de « prochaines sorties » pour un livre :
              historique (↑ passé) puis à lire (maintenant), un seul défilement */}
          {category === "books" && (
            <>
              {historyBookAscending.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p className="tiny" style={{ textAlign: "center", color: "var(--text-3)", marginBottom: 10 }}>
                    ↑ Historique de lecture
                  </p>
                  <div className="stack">{recentHistoryBook.map(renderHistoryCard)}</div>
                </div>
              )}

              <h2 className="section-title" ref={catchupDividerRef} style={{ scrollMarginTop: 80 }}>
                À lire{booksToCatchUp.length > 0 && <small>{booksToCatchUp.length}</small>}
              </h2>

              {booksToCatchUp.length === 0 ? (
                    <div className="glass card" style={{ textAlign: "center", marginBottom: 20 }}>
                      <span className="muted">Aucun livre à lire.</span>
                    </div>
                  ) : (
                    <div className="stack" style={{ marginBottom: 20 }}>
                      {booksToCatchUp.map((book) => {
                        const progress = bookProgress?.[book.id] || { current: 0, total: book.pages || 300 };
                        const percent = Math.min(100, Math.round((progress.current / progress.total) * 100));
                        const isEditing = editingBookId === book.id;

                        return (
                          <SwipeableRow
                            key={`catchup-book-${book.id}`}
                            onTap={() => router.push(`/book/${book.id}`)}
                            onSwipeRight={() => markBookDone(book)}
                            onSwipeLeft={() => removeBookFromWatchlist(book)}
                          >
                            <div className="glass agenda-card pressable" style={{ flexDirection: "column", alignItems: "stretch", gap: 10, padding: 12 }}>
                              <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                                <Poster item={{ ...book, status: bookStatus(true, false) }} mini />
                                <div className="agenda-body" style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.2 }}>{book.title}</div>
                                  <div className="muted" style={{ marginTop: 2, fontSize: 13 }}>📚 Livre à lire</div>
                                </div>
                                <button
                                  className="check"
                                  aria-label={`Marquer ${book.title} comme lu`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markBookDone(book);
                                  }}
                                  style={{ alignSelf: "center" }}
                                >
                                  ✓
                                </button>
                              </div>

                              {isEditing ? (
                                <div
                                  className="row"
                                  style={{
                                    gap: 8,
                                    padding: "8px 10px",
                                    background: "var(--accent-wash)",
                                    borderRadius: 8,
                                    border: "1px solid var(--accent)",
                                    alignItems: "center",
                                    flexWrap: "wrap"
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>Page</span>
                                  <input
                                    type="number"
                                    className="input"
                                    style={{
                                      width: 65,
                                      padding: "4px 8px",
                                      fontSize: 13,
                                      background: "var(--surface)",
                                      border: "1px solid var(--glass-border)",
                                      borderRadius: 6,
                                      color: "var(--text-1)"
                                    }}
                                    value={editPageVal}
                                    min={0}
                                    max={editTotalVal}
                                    onChange={(e) => setEditPageVal(Number(e.target.value))}
                                  />
                                  <span style={{ fontSize: 13 }}>sur</span>
                                  <input
                                    type="number"
                                    className="input"
                                    style={{
                                      width: 65,
                                      padding: "4px 8px",
                                      fontSize: 13,
                                      background: "var(--surface)",
                                      border: "1px solid var(--glass-border)",
                                      borderRadius: 6,
                                      color: "var(--text-1)"
                                    }}
                                    value={editTotalVal}
                                    min={1}
                                    onChange={(e) => setEditTotalVal(Number(e.target.value))}
                                  />
                                  <div className="row" style={{ gap: 6, marginLeft: "auto" }}>
                                    <button
                                      className="btn btn-primary pressable"
                                      style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, fontWeight: 700 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateBookProgress(book.id, editPageVal, editTotalVal);
                                        setEditingBookId(null);
                                      }}
                                    >
                                      Valider
                                    </button>
                                    <button
                                      className="btn pressable"
                                      style={{
                                        padding: "4px 10px",
                                        fontSize: 12,
                                        borderRadius: 6,
                                        background: "transparent",
                                        border: "1px solid var(--glass-border)"
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingBookId(null);
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ width: "100%", padding: "4px 0" }} onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "var(--text-3)" }}>
                                    <span>Page {progress.current} sur {progress.total}</span>
                                    <button
                                      style={{
                                        background: "none",
                                        border: "none",
                                        color: "var(--accent)",
                                        padding: 0,
                                        font: "inherit",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        textDecoration: "underline"
                                      }}
                                      onClick={() => {
                                        setEditingBookId(book.id);
                                        setEditPageVal(progress.current);
                                        setEditTotalVal(progress.total);
                                      }}
                                    >
                                      Mettre à jour
                                    </button>
                                  </div>
                                  <div style={{ height: 6, background: "var(--hairline)", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${percent}%`, background: "var(--accent)", borderRadius: 3 }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </SwipeableRow>
                        );
                      })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
