"use client";

import Link from "next/link";
import Poster from "@/components/Poster";
import { useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import {
  airedEpisodes,
  epLabel,
  fmtRelative,
  fmtRelativeOrDate,
  minutesHuman,
  nextEpisode,
  nextUpcoming,
  watchedCount,
} from "@/lib/utils";

export default function WatchlistPage() {
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
        <h1 className="page-title">À suivre</h1>
        <p className="page-sub">{today}</p>
      </main>
    );
  }

  const shows = followed.map((id) => showCache[id]).filter(Boolean);
  const loadingCount = followed.length - shows.length;
  const withNext = shows
    .map((show) => ({ show, next: nextEpisode(show, watched[show.id]) }))
    .sort((a, b) => (a.next ? 0 : 1) - (b.next ? 0 : 1));

  const toWatch = withNext.filter((x) => x.next).length;
  const totalMin = shows.reduce(
    (acc, s) => acc + watchedCount(s, watched[s.id]) * (s.runtime ?? 45),
    0
  );

  return (
    <main className="page">
      <h1 className="page-title">À suivre</h1>
      <p className="page-sub">{today}</p>

      {followed.length > 0 && (
        <div className="row" style={{ marginBottom: 20 }}>
          <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{toWatch}</div>
            <div className="tiny">à rattraper</div>
          </div>
          <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{followed.length}</div>
            <div className="tiny">séries suivies</div>
          </div>
          <div className="glass card" style={{ flex: 1, textAlign: "center", padding: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>
              {minutesHuman(totalMin).split(" ").slice(0, 2).join(" ")}
            </div>
            <div className="tiny">de visionnage</div>
          </div>
        </div>
      )}

      {followed.length === 0 ? (
        <div className="glass empty">
          <div className="big">📺</div>
          <h2 style={{ fontSize: 19, marginBottom: 8 }}>Aucune série suivie</h2>
          <p className="muted" style={{ marginBottom: 18 }}>
            Ajoutez vos séries préférées pour suivre les épisodes qu'il vous
            reste à voir.
          </p>
          <Link href="/discover" className="btn btn-primary pressable">
            Découvrir des séries
          </Link>
        </div>
      ) : (
        <div className="stack stack-wide">
          {withNext.map(({ show, next }) => {
            const aired = airedEpisodes(show).length;
            const seen = watchedCount(show, watched[show.id]);
            const upcoming = nextUpcoming(show);
            return (
              <div key={show.id} className="glass card">
                <div className="row">
                  <Link href={`/show/${show.id}`}>
                    <Poster item={show} mini />
                  </Link>
                  <Link href={`/show/${show.id}`} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {show.title}
                    </div>
                    {next ? (
                      <>
                        <div className="muted" style={{ marginTop: 2 }}>
                          {epLabel(next)} — {next.title}
                        </div>
                        {next.airDate && (
                          <div className="tiny" style={{ marginTop: 2 }}>
                            diffusé {fmtRelativeOrDate(next.airDate)}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="muted" style={{ marginTop: 2 }}>
                          ✓ À jour
                        </div>
                        <div className="tiny" style={{ marginTop: 2 }}>
                          {upcoming?.airDate
                            ? `prochain épisode ${fmtRelative(upcoming.airDate)}`
                            : show.status === "Terminée"
                              ? "série terminée"
                              : "en attente de nouveaux épisodes"}
                        </div>
                      </>
                    )}
                  </Link>
                  {next && (
                    <button
                      className="check"
                      aria-label={`Marquer ${epLabel(next)} comme vu`}
                      onClick={() => setEpisode(show.id, next.s, next.e, true)}
                    >
                      ✓
                    </button>
                  )}
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
          {loadingCount > 0 && (
            <div className="glass card" style={{ textAlign: "center" }}>
              <span className="muted">
                Chargement de {loadingCount} série{loadingCount > 1 ? "s" : ""}…
              </span>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
