"use client";

import Link from "next/link";
import { useMemo } from "react";
import Poster from "@/components/Poster";
import { useHydrateLibrary } from "@/lib/client";
import { useIncremental } from "@/lib/useIncremental";
import { useMounted, useTrack } from "@/lib/store";
import {
  allEpisodes,
  effectiveShowStatus,
  epLabel,
  fmtRelative,
  fmtRelativeWithTime,
  movieStatus,
} from "@/lib/utils";
import type { Episode, Movie, Show } from "@/lib/types";

type UpcomingItem =
  | { kind: "ep"; key: string; date: string; show: Show; ep: Episode }
  | { kind: "movie"; key: string; date: string; movie: Movie };

export default function UpcomingPage() {
  const mounted = useMounted();
  const { followed, showCache, showStatus, movieWatchlist, movieCache } = useTrack();
  useHydrateLibrary();

  // Séries suivies non abandonnées → épisodes encore à venir.
  const agendaShows = useMemo(
    () =>
      mounted
        ? followed
            .map((id) => showCache[id])
            .filter((s): s is Show => !!s && (showStatus[s.id] ?? "active") !== "dropped")
        : [],
    [mounted, followed, showCache, showStatus]
  );

  // Timeline unifiée : épisodes à venir + sorties de films à venir, triés par
  // date croissante (le plus proche en premier).
  const items = useMemo(() => {
    if (!mounted) return [] as UpcomingItem[];
    const now = Date.now();

    const eps: UpcomingItem[] = agendaShows.flatMap((show) =>
      allEpisodes(show)
        .filter((ep) => ep.airDate && new Date(ep.airDate).getTime() > now)
        .map((ep) => ({
          kind: "ep" as const,
          key: `ep-${show.id}-${ep.s}:${ep.e}`,
          date: ep.airDate!,
          show,
          ep,
        }))
    );

    const movies: UpcomingItem[] = movieWatchlist
      .map((id) => movieCache[id])
      .filter((m): m is Movie => !!m?.releaseDate && new Date(m.releaseDate).getTime() > now)
      .map((m) => ({ kind: "movie" as const, key: `movie-${m.id}`, date: m.releaseDate!, movie: m }));

    return [...eps, ...movies].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [mounted, agendaShows, movieWatchlist, movieCache]);

  const { visible, sentinelRef, hasMore } = useIncremental(items);

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Avenir</h1>
        <p className="page-sub">Prochaines diffusions et sorties</p>
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
      <h1 className="page-title">Avenir</h1>
      <p className="page-sub">Prochaines diffusions et sorties</p>

      {items.length === 0 ? (
        <div className="glass empty">
          <div className="big">🔭</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Rien à l'horizon</h2>
          <p className="muted" style={{ marginBottom: 20, maxWidth: 320, marginInline: "auto", lineHeight: 1.5 }}>
            Les prochains épisodes de vos séries et les sorties de vos films à voir
            apparaîtront ici dès qu'une date est connue.
          </p>
          <Link
            href="/discover"
            className="btn btn-primary pressable"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 12, fontWeight: 700 }}
          >
            Découvrir
          </Link>
        </div>
      ) : (
        <div className="stack">
          {visible.map((item, i) => {
            const delay = { animationDelay: `${Math.min(i, 8) * 40}ms` };
            return item.kind === "ep" ? (
              <Link
                key={item.key}
                href={`/show/${item.show.id}`}
                className="glass agenda-card pressable stagger-item-in"
                style={delay}
              >
                <Poster
                  item={{ ...item.show, status: effectiveShowStatus(item.show, showStatus[item.show.id]) }}
                  mini
                />
                <div className="agenda-body">
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>{item.show.title}</div>
                  <div className="muted" style={{ marginTop: 2 }}>
                    {epLabel(item.ep)} — {item.ep.title}
                  </div>
                </div>
                <span className="badge-pill">{fmtRelativeWithTime(item.date)}</span>
              </Link>
            ) : (
              <Link
                key={item.key}
                href={`/movie/${item.movie.id}`}
                className="glass agenda-card pressable stagger-item-in"
                style={delay}
              >
                <Poster item={{ ...item.movie, status: movieStatus(true, false) }} mini />
                <div className="agenda-body">
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>{item.movie.title}</div>
                  <div className="muted" style={{ marginTop: 2 }}>🎬 Sortie du film</div>
                </div>
                <span className="badge-pill">{fmtRelative(item.date)}</span>
              </Link>
            );
          })}
          {hasMore && <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />}
        </div>
      )}
    </main>
  );
}
