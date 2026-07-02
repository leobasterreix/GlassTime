"use client";

import { useParams, useRouter } from "next/navigation";
import { getShow } from "@/lib/data";
import { useMounted, useTrack } from "@/lib/store";
import {
  airedEpisodes,
  epKey,
  fmtDate,
  fmtRelative,
  isAired,
  watchedCount,
} from "@/lib/utils";

export default function ShowPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const mounted = useMounted();
  const { followed, watched, toggleFollow, setEpisode, setEpisodes } =
    useTrack();

  const show = getShow(Number(params.id));
  if (!show) {
    return (
      <main className="page">
        <div className="glass empty">
          <div className="big">🫥</div>
          <p className="muted">Série introuvable.</p>
        </div>
      </main>
    );
  }

  const map = mounted ? watched[show.id] : undefined;
  const isFollowed = mounted && followed.includes(show.id);
  const aired = airedEpisodes(show);
  const seen = watchedCount(show, map);
  const pct = aired.length ? Math.round((seen / aired.length) * 100) : 0;
  const allSeen = aired.length > 0 && seen >= aired.length;

  return (
    <main className="page">
      <button
        className="chip pressable"
        onClick={() => router.back()}
        style={{ marginBottom: 16 }}
      >
        ← Retour
      </button>

      {/* En-tête */}
      <div
        className="glass"
        style={{
          padding: 24,
          textAlign: "center",
          background: `linear-gradient(170deg, ${show.colors[1]}55, ${show.colors[0]}33), var(--glass-bg)`,
          overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 64, filter: "drop-shadow(0 8px 20px rgba(0,0,0,.5))" }}>
          {show.emoji}
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 8 }}>
          {show.title}
        </h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {show.year} · {show.genres.join(" · ")} · {show.status}
        </p>
        <p className="muted" style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, textAlign: "left" }}>
          {show.overview}
        </p>

        <div className="row" style={{ marginTop: 18, gap: 10 }}>
          <button
            className={`btn pressable ${isFollowed ? "btn-success" : "btn-primary"}`}
            style={{ flex: 1 }}
            onClick={() => toggleFollow(show.id)}
          >
            {isFollowed ? "✓ Suivie" : "+ Suivre"}
          </button>
          <button
            className="btn pressable"
            style={{ flex: 1 }}
            onClick={() =>
              setEpisodes(
                show.id,
                aired.map(({ s, e }) => ({ s, e })),
                !allSeen
              )
            }
          >
            {allSeen ? "Tout marquer non vu" : "Tout marquer vu"}
          </button>
        </div>

        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <div className="progress" style={{ flex: 1 }}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <span className="tiny">
            {seen}/{aired.length} · {pct}%
          </span>
        </div>
      </div>

      {/* Saisons */}
      <h2 className="section-title">Saisons</h2>
      <div className="stack">
        {show.seasons.map((season) => {
          const seasonAired = season.episodes.filter((ep) => isAired(ep));
          const seasonSeen = season.episodes.filter(
            (ep) => map?.[epKey(ep.s, ep.e)]
          ).length;
          const seasonAll =
            seasonAired.length > 0 && seasonSeen >= seasonAired.length;
          return (
            <details key={season.n} className="glass season" style={{ padding: "4px 16px" }}>
              <summary className="row" style={{ padding: "12px 0" }}>
                <span className="chevron" style={{ color: "var(--text-3)" }}>▶</span>
                <span style={{ fontWeight: 700, flex: 1 }}>
                  Saison {season.n}
                </span>
                <span className="tiny">
                  {seasonSeen}/{season.episodes.length}
                </span>
                <button
                  className={`check small${seasonAll ? " checked" : ""}`}
                  aria-label={`Marquer la saison ${season.n}`}
                  disabled={seasonAired.length === 0}
                  onClick={(ev) => {
                    ev.preventDefault();
                    setEpisodes(
                      show.id,
                      seasonAired.map(({ s, e }) => ({ s, e })),
                      !seasonAll
                    );
                  }}
                >
                  ✓
                </button>
              </summary>
              <div className="stack" style={{ paddingBottom: 14, gap: 4 }}>
                {season.episodes.map((ep) => {
                  const aired_ = isAired(ep);
                  const seen_ = !!map?.[epKey(ep.s, ep.e)];
                  return (
                    <div
                      key={ep.e}
                      className="row"
                      style={{ padding: "7px 0", opacity: aired_ ? 1 : 0.55 }}
                    >
                      <span
                        className="tiny"
                        style={{ width: 28, textAlign: "center" }}
                      >
                        {ep.e}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                          {ep.title}
                        </div>
                        <div className="tiny">
                          {aired_
                            ? fmtDate(ep.airDate)
                            : `${fmtDate(ep.airDate)} · ${fmtRelative(ep.airDate)}`}
                        </div>
                      </div>
                      <button
                        className={`check small${seen_ ? " checked" : ""}`}
                        disabled={!aired_}
                        aria-label={`Épisode ${ep.e} ${seen_ ? "vu" : "non vu"}`}
                        onClick={() =>
                          setEpisode(show.id, ep.s, ep.e, !seen_)
                        }
                      >
                        ✓
                      </button>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </main>
  );
}
