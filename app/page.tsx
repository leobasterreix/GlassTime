"use client";

import Link from "next/link";
import { useEffect } from "react";
import Poster from "@/components/Poster";
import { useHydrateLibrary } from "@/lib/client";
import { notifyTodayEpisodes, updateAppBadge } from "@/lib/notifications";
import { useMounted, useTrack } from "@/lib/store";
import { markEpisodeWatched } from "@/lib/watch";
import {
  airedEpisodes,
  allEpisodes,
  DAY,
  epLabel,
  fmtDateLong,
  fmtRelative,
  fmtRelativeOrDate,
  nextEpisode,
  watchedCount,
} from "@/lib/utils";
import type { Episode, Movie, Show } from "@/lib/types";

type Entry =
  | { kind: "ep"; date: string; show: Show; ep: Episode }
  | { kind: "movie"; date: string; movie: Movie };

export default function AgendaPage() {
  const mounted = useMounted();
  const { followed, watched, showCache, movieWatchlist, movieCache, showStatus } =
    useTrack();
  useHydrateLibrary();

  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const shows = mounted
    ? followed.map((id) => showCache[id]).filter(Boolean)
    : [];
  // « abandonnée » disparaît de l'agenda ; « en pause » garde ses diffusions
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

  const epEntries: Entry[] = agendaShows
    .flatMap((show) =>
      allEpisodes(show)
        .filter((ep) => ep.airDate)
        .map((ep): Entry => ({ kind: "ep", date: ep.airDate!, show, ep }))
    )
    .filter(({ date }) => {
      const t = new Date(date).getTime();
      return t > now && t <= horizon;
    });

  const movieEntries: Entry[] = mounted
    ? movieWatchlist
        .map((id) => movieCache[id])
        .filter((m): m is Movie => !!m?.releaseDate)
        .filter((m) => {
          const t = new Date(m.releaseDate!).getTime();
          return t > now && t <= horizon;
        })
        .map((m): Entry => ({ kind: "movie", date: m.releaseDate!, movie: m }))
    : [];

  const upcoming = [...epEntries, ...movieEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const byDay = new Map<string, Entry[]>();
  for (const entry of upcoming) {
    const day = entry.date.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }

  // Pastille d'icône + notification des sorties du jour
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, pendingEpisodes]);

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Agenda</h1>
        <p className="page-sub">{today}</p>
        <div className="stack">
          <div className="skeleton" style={{ height: 90 }} />
          <div className="skeleton" style={{ height: 90 }} />
          <div className="skeleton" style={{ height: 90 }} />
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

          {/* À rattraper */}
          <h2 className="section-title">
            À rattraper
            {toCatchUp.length > 0 && <small>{toCatchUp.length}</small>}
          </h2>
          {toCatchUp.length === 0 ? (
            <div className="glass card" style={{ textAlign: "center" }}>
              <span className="muted">
                ✓ Vous êtes à jour sur toutes vos séries !
              </span>
            </div>
          ) : (
            <div className="stack stack-wide">
              {toCatchUp.map(({ show, next }) => {
                const aired = airedEpisodes(show).length;
                const seen = watchedCount(show, watched[show.id]);
                return (
                  <div
                    key={show.id}
                    className={`glass card${show.backdrop ? " card-backdrop" : ""}`}
                    style={
                      show.backdrop
                        ? { backgroundImage: `url(${show.backdrop})` }
                        : undefined
                    }
                  >
                    <div className="row">
                      <Link href={`/show/${show.id}`}>
                        <Poster item={show} mini />
                      </Link>
                      <Link
                        href={`/show/${show.id}`}
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 16 }}>
                          {show.title}
                        </div>
                        <div className="muted" style={{ marginTop: 2 }}>
                          {epLabel(next)} — {next.title}
                        </div>
                        {next.airDate && (
                          <div className="tiny" style={{ marginTop: 2 }}>
                            diffusé {fmtRelativeOrDate(next.airDate)}
                          </div>
                        )}
                      </Link>
                      <button
                        className="check"
                        aria-label={`Marquer ${epLabel(next)} comme vu`}
                        onClick={() => markEpisodeWatched(show, next)}
                      >
                        ✓
                      </button>
                    </div>
                    <div className="row" style={{ marginTop: 12, gap: 10 }}>
                      <div className="progress" style={{ flex: 1 }}>
                        <div
                          style={{
                            width: `${aired ? Math.round((seen / aired) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <span className="tiny">
                        {seen}/{aired}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {loadingCount > 0 && (
            <div className="stack" style={{ marginTop: 12 }}>
              {Array.from({ length: Math.min(loadingCount, 3) }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 90 }} />
              ))}
            </div>
          )}

          {/* Prochaines diffusions */}
          <h2 className="section-title">Prochaines diffusions</h2>
          {byDay.size === 0 ? (
            <div className="glass card" style={{ textAlign: "center" }}>
              <span className="muted">
                Aucune diffusion prévue dans les 45 prochains jours.
              </span>
            </div>
          ) : (
            Array.from(byDay.entries()).map(([day, dayEntries]) => (
              <div key={day}>
                <h3
                  className="section-title"
                  style={{ textTransform: "capitalize", fontSize: 16 }}
                >
                  {fmtDateLong(day)}
                  <small>{fmtRelative(day)}</small>
                </h3>
                <div className="stack stack-wide">
                  {dayEntries.map((entry) =>
                    entry.kind === "ep" ? (
                      <Link
                        key={`ep-${entry.show.id}-${entry.ep.s}:${entry.ep.e}`}
                        href={`/show/${entry.show.id}`}
                        className="glass card pressable row"
                      >
                        <Poster item={entry.show} mini />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15.5 }}>
                            {entry.show.title}
                          </div>
                          <div className="muted" style={{ marginTop: 2 }}>
                            {epLabel(entry.ep)} — {entry.ep.title}
                          </div>
                        </div>
                        <span className="badge-pill">
                          {fmtRelative(entry.date)}
                        </span>
                      </Link>
                    ) : (
                      <Link
                        key={`movie-${entry.movie.id}`}
                        href={`/movie/${entry.movie.id}`}
                        className="glass card pressable row"
                      >
                        <Poster item={entry.movie} mini />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15.5 }}>
                            {entry.movie.title}
                          </div>
                          <div className="muted" style={{ marginTop: 2 }}>
                            🎬 Sortie du film
                          </div>
                        </div>
                        <span className="badge-pill">
                          {fmtRelative(entry.date)}
                        </span>
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </main>
  );
}
