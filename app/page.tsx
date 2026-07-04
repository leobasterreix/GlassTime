"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Poster from "@/components/Poster";
import SwipeableRow from "@/components/SwipeableRow";
import { useHydrateLibrary } from "@/lib/client";
import { notifyTodayEpisodes, updateAppBadge } from "@/lib/notifications";
import { useMounted, useTrack } from "@/lib/store";
import { markEpisodeWatched } from "@/lib/watch";
import { toast } from "@/lib/toast";
import {
  airedEpisodes,
  allEpisodes,
  DAY,
  effectiveShowStatus,
  epLabel,
  fmtRelative,
  fmtRelativeOrDate,
  movieStatus,
  nextEpisode,
  watchedCount,
} from "@/lib/utils";
import type { Episode, Movie, Show } from "@/lib/types";

type AgendaCard =
  | { kind: "catchup"; key: string; date: string; show: Show; ep: Episode }
  | { kind: "upcoming-ep"; key: string; date: string; show: Show; ep: Episode }
  | { kind: "upcoming-movie"; key: string; date: string; movie: Movie };

const STALE_DAYS = 60;

export default function AgendaPage() {
  const router = useRouter();
  const mounted = useMounted();
  const {
    followed,
    watched,
    lastWatchedAt,
    showCache,
    movieWatchlist,
    movieCache,
    showStatus,
    pushNotification,
    toggleFollow,
    toggleMovieWatchlist,
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

  const toCatchUp = activeShows
    .map((show) => ({ show, next: nextEpisode(show, watched[show.id]) }))
    .filter((x): x is { show: Show; next: Episode } => x.next !== null);

  const pendingEpisodes = activeShows.reduce(
    (acc, s) =>
      acc +
      Math.max(0, airedEpisodes(s).length - watchedCount(s, watched[s.id])),
    0
  );

  // Prochaines diffusions : épisodes des séries suivies + sorties des films à voir
  const now = Date.now();
  const horizon = now + 45 * DAY;

  const epEntries = agendaShows
    .flatMap((show) =>
      allEpisodes(show)
        .filter((ep) => ep.airDate)
        .map((ep) => ({ show, ep, date: ep.airDate! }))
    )
    .filter(({ date }) => {
      const t = new Date(date).getTime();
      return t > now && t <= horizon;
    });

  const movieEntries = mounted
    ? movieWatchlist
        .map((id) => movieCache[id])
        .filter((m): m is Movie => !!m?.releaseDate)
        .filter((m) => {
          const t = new Date(m.releaseDate!).getTime();
          return t > now && t <= horizon;
        })
        .map((m) => ({ movie: m, date: m.releaseDate! }))
    : [];

  // Une seule colonne, cartes de taille uniforme : à rattraper (dates
  // passées) et prochaines diffusions (dates futures) triées ensemble par
  // date — pas besoin de séparer en deux listes, l'ordre chronologique fait
  // naturellement remonter le rattrapage en premier.
  const agendaCards: AgendaCard[] = [
    ...toCatchUp.map(({ show, next }): AgendaCard => ({
      kind: "catchup",
      // Inclut l'épisode dans la clé (pas juste la série) : après un swipe,
      // l'épisode suivant doit remonter une carte neuve (état "removing" du
      // swipe précédent ne doit pas persister sur la série).
      key: `catchup-${show.id}-${next.s}:${next.e}`,
      date: next.airDate!,
      show,
      ep: next,
    })),
    ...epEntries.map(
      ({ show, ep, date }): AgendaCard => ({
        kind: "upcoming-ep",
        key: `ep-${show.id}-${ep.s}:${ep.e}`,
        date,
        show,
        ep,
      })
    ),
    ...movieEntries.map(
      ({ movie, date }): AgendaCard => ({
        kind: "upcoming-movie",
        key: `movie-${movie.id}`,
        date,
        movie,
      })
    ),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

  function removeShow(show: Show) {
    toggleFollow(show.id);
    toast(`${show.title} retirée du suivi`, "🗑");
  }

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

          <p className="tiny" style={{ marginBottom: 10, color: "var(--text-3)" }}>
            Glissez une carte à droite pour marquer vu, à gauche pour retirer la série.
          </p>

          {loadingCount > 0 && (
            <div className="stack" style={{ marginBottom: 20 }}>
              {Array.from({ length: Math.min(loadingCount, 3) }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 76 }} />
              ))}
            </div>
          )}

          {agendaCards.length === 0 ? (
            <div className="glass card" style={{ textAlign: "center" }}>
              <span className="muted">
                Rien à rattraper, ni de diffusion prévue dans les 45 prochains jours.
              </span>
            </div>
          ) : (
            <div className="stack">
              {agendaCards.map((card) => {
                if (card.kind === "catchup") {
                  const badge = catchupBadge(card.show);
                  return (
                    <SwipeableRow
                      key={card.key}
                      onTap={() => router.push(`/show/${card.show.id}`)}
                      onSwipeRight={() => markEpisodeWatched(card.show, card.ep)}
                      onSwipeLeft={() => removeShow(card.show)}
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
                          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 700, fontSize: 15.5 }}>{card.show.title}</div>
                            {badge && (
                              <span className="agenda-status-pill">
                                {badge.emoji} {badge.label}
                              </span>
                            )}
                          </div>
                          <div className="muted" style={{ marginTop: 2 }}>
                            {epLabel(card.ep)} — {card.ep.title}
                          </div>
                          <div className="tiny" style={{ marginTop: 2 }}>
                            diffusé {fmtRelativeOrDate(card.date)}
                          </div>
                        </div>
                        <button
                          className="check"
                          aria-label={`Marquer ${epLabel(card.ep)} comme vu`}
                          onClick={(e) => {
                            e.stopPropagation();
                            markEpisodeWatched(card.show, card.ep);
                          }}
                        >
                          ✓
                        </button>
                      </div>
                    </SwipeableRow>
                  );
                }
                if (card.kind === "upcoming-ep") {
                  return (
                    <SwipeableRow
                      key={card.key}
                      onTap={() => router.push(`/show/${card.show.id}`)}
                      onSwipeLeft={() => removeShow(card.show)}
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
                        <span className="badge-pill">{fmtRelative(card.date)}</span>
                      </div>
                    </SwipeableRow>
                  );
                }
                return (
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
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
