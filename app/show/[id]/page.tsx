"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Poster from "@/components/Poster";
import { apiGet, followShow } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import type { Show, Review } from "@/lib/types";
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
  const id = Number(params.id);
  const mounted = useMounted();
  const { followed, watched, showCache, cacheShow, setEpisode, setEpisodes } =
    useTrack();

  const [fetched, setFetched] = useState<Show | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiGet<Show>(`/api/show/${id}`).then((data) => {
      if (cancelled) return;
      if (data) {
        setFetched(data);
        if (useTrack.getState().followed.includes(data.id))
          useTrack.getState().cacheShow(data);
      } else setNotFound(true);
    });
    apiGet<Review[]>(`/api/show/${id}/reviews`).then((data) => {
      if (cancelled) return;
      if (data) setReviews(data);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const show = fetched ?? (mounted ? showCache[id] : undefined);

  if (!show) {
    return (
      <main className="page">
        <button className="chip pressable" onClick={() => router.back()} style={{ marginBottom: 16 }}>
          ← Retour
        </button>
        <div className="glass empty">
          <div className="big">{notFound ? "🫥" : "⏳"}</div>
          <p className="muted">
            {notFound ? "Série introuvable." : "Chargement…"}
          </p>
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
  const hasSeasons = (show.seasons ?? []).length > 0;

  const heroBg = show.backdrop
    ? `linear-gradient(180deg, rgba(6,7,13,.25), rgba(6,7,13,.85)), url(${show.backdrop}) center/cover`
    : show.colors
      ? `linear-gradient(170deg, ${show.colors[1]}55, ${show.colors[0]}33)`
      : undefined;

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
        className="glass show-hero"
        style={{
          background: heroBg ? `${heroBg}, var(--glass-bg)` : undefined,
        }}
      >
        <div className="hero-poster">
          <Poster item={show} />
        </div>
        <div className="hero-body">
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 14 }}>
          {show.title}
        </h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {[
            show.year || null,
            show.genres.join(" · ") || null,
            show.status ?? null,
            show.rating ? `★ ${show.rating.toFixed(1)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {show.overview && (
          <p className="muted" style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, textAlign: "left" }}>
            {show.overview}
          </p>
        )}

        <div className="row" style={{ marginTop: 18, gap: 10 }}>
          <button
            className={`btn pressable ${isFollowed ? "btn-success" : "btn-primary"}`}
            style={{ flex: 1 }}
            onClick={() => followShow(show)}
          >
            {isFollowed ? "✓ Suivie" : "+ Suivre"}
          </button>
          <button
            className="btn pressable"
            style={{ flex: 1 }}
            disabled={!hasSeasons}
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
      </div>

      {/* Saisons */}
      <h2 className="section-title">Saisons</h2>
      {!hasSeasons ? (
        <div className="glass empty">
          <div className="big">⏳</div>
          <p className="muted">Chargement des épisodes…</p>
        </div>
      ) : (
        <div className="stack">
          {(show.seasons ?? []).map((season) => {
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
                            {!ep.airDate
                              ? "date inconnue"
                              : aired_
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
      )}

      {/* Avis */}
      <h2 className="section-title">Avis</h2>
      {reviews.length === 0 ? (
        <div className="glass empty" style={{ padding: "24px 16px" }}>
          <p className="muted">Aucun avis rédigé pour le moment.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12, marginBottom: 24 }}>
          {reviews.map((r) => (
            <div key={r.id} className="glass card" style={{ padding: 18 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, alignItems: "flex-start" }}>
                <div className="row" style={{ gap: 10 }}>
                  {r.avatar ? (
                    <img
                      src={r.avatar}
                      alt={r.author}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1.5px solid var(--glass-border)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "var(--glass-bg-strong)",
                        border: "1.5px solid var(--glass-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text-2)",
                      }}
                    >
                      {r.author[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{r.author}</div>
                    <div className="tiny" style={{ fontSize: 11 }}>
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""}
                    </div>
                  </div>
                </div>
                {r.rating && (
                  <span className="badge-pill" style={{ fontSize: 12 }}>
                    ★ {r.rating.toFixed(0)}/10
                  </span>
                )}
              </div>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                {r.content.length > 350 ? `${r.content.slice(0, 350)}...` : r.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
