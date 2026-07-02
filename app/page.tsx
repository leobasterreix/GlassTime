"use client";

import Link from "next/link";
import Poster from "@/components/Poster";
import { useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
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
import type { Episode, Show } from "@/lib/types";

type Entry = { show: Show; ep: Episode };

export default function AgendaPage() {
  const mounted = useMounted();
  const { followed, watched, showCache, setEpisode } = useTrack();
  useHydrateLibrary();

  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Agenda</h1>
        <p className="page-sub">{today}</p>
      </main>
    );
  }

  const shows = followed.map((id) => showCache[id]).filter(Boolean);
  const loadingCount = followed.length - shows.length;

  // Séries avec des épisodes diffusés non vus
  const toCatchUp = shows
    .map((show) => ({ show, next: nextEpisode(show, watched[show.id]) }))
    .filter((x): x is { show: Show; next: Episode } => x.next !== null);

  const pendingEpisodes = shows.reduce(
    (acc, s) =>
      acc +
      Math.max(0, airedEpisodes(s).length - watchedCount(s, watched[s.id])),
    0
  );

  // Prochaines diffusions (45 jours), groupées par jour
  const now = Date.now();
  const horizon = now + 45 * DAY;
  const upcoming: Entry[] = shows
    .flatMap((show) =>
      allEpisodes(show)
        .filter((ep) => ep.airDate)
        .map((ep) => ({ show, ep }))
    )
    .filter(({ ep }) => {
      const t = new Date(ep.airDate!).getTime();
      return t > now && t <= horizon;
    })
    .sort(
      (a, b) =>
        new Date(a.ep.airDate!).getTime() - new Date(b.ep.airDate!).getTime()
    );

  const byDay = new Map<string, Entry[]>();
  for (const entry of upcoming) {
    const day = entry.ep.airDate!.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
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
                  <div key={show.id} className="glass card">
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
                        onClick={() =>
                          setEpisode(show.id, next.s, next.e, true)
                        }
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
            <div className="glass card" style={{ textAlign: "center", marginTop: 12 }}>
              <span className="muted">
                Chargement de {loadingCount} série{loadingCount > 1 ? "s" : ""}…
              </span>
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
                  {dayEntries.map(({ show, ep }) => (
                    <Link
                      key={`${show.id}-${ep.s}:${ep.e}`}
                      href={`/show/${show.id}`}
                      className="glass card pressable row"
                    >
                      <Poster item={show} mini />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 15.5 }}>
                          {show.title}
                        </div>
                        <div className="muted" style={{ marginTop: 2 }}>
                          {epLabel(ep)} — {ep.title}
                        </div>
                      </div>
                      <span className="badge-pill">
                        {fmtRelative(ep.airDate!)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </main>
  );
}
