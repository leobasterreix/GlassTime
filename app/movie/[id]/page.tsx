"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Poster from "@/components/Poster";
import { apiGet } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import type { Movie, Review } from "@/lib/types";
import { minutesHuman } from "@/lib/utils";

export default function MoviePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const mounted = useMounted();
  const {
    movieWatchlist,
    moviesWatched,
    movieCache,
    cacheMovie,
    toggleMovieWatchlist,
    toggleMovieWatched,
  } = useTrack();

  const [fetched, setFetched] = useState<Movie | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiGet<Movie>(`/api/movie/${id}`).then((data) => {
      if (cancelled) return;
      if (data) {
        setFetched(data);
        useTrack.getState().cacheMovie(data);
      } else setNotFound(true);
    });
    apiGet<Review[]>(`/api/movie/${id}/reviews`).then((data) => {
      if (cancelled) return;
      if (data) setReviews(data);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const movie = fetched ?? (mounted ? movieCache[id] : undefined);

  if (!movie) {
    return (
      <main className="page">
        <button className="chip pressable" onClick={() => router.back()} style={{ marginBottom: 16 }}>
          ← Retour
        </button>
        <div className="glass empty">
          <div className="big">{notFound ? "🫥" : "⏳"}</div>
          <p className="muted">
            {notFound ? "Film introuvable." : "Chargement…"}
          </p>
        </div>
      </main>
    );
  }

  const inList = mounted && movieWatchlist.includes(movie.id);
  const seen = mounted && moviesWatched.includes(movie.id);

  const heroBg = movie.poster
    ? `linear-gradient(180deg, rgba(6,7,13,.25), rgba(6,7,13,.85))`
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
          <Poster item={movie} />
        </div>
        <div className="hero-body">
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 14 }}>
            {movie.title}
          </h1>
          <p className="muted" style={{ marginTop: 6 }}>
            {[
              movie.year || null,
              movie.runtime ? minutesHuman(movie.runtime) : null,
              movie.genres.join(" · ") || null,
              movie.rating ? `★ ${movie.rating.toFixed(1)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {movie.overview && (
            <p className="muted" style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, textAlign: "left" }}>
              {movie.overview}
            </p>
          )}

          <div className="row" style={{ marginTop: 18, gap: 10 }}>
            {!seen && (
              <button
                className={`btn pressable ${inList ? "btn-success" : "btn-primary"}`}
                style={{ flex: 1 }}
                onClick={() => toggleMovieWatchlist(movie.id)}
              >
                {inList ? "✓ À voir" : "+ À voir"}
              </button>
            )}
            <button
              className={`btn pressable ${seen ? "btn-success" : "btn-primary"}`}
              style={{ flex: 1 }}
              onClick={() => toggleMovieWatched(movie.id)}
            >
              {seen ? "✓ Vu" : "👁 Vu"}
            </button>
          </div>
        </div>
      </div>

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
