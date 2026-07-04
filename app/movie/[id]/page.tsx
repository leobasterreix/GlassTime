"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Poster from "@/components/Poster";
import FavoriteButton from "@/components/FavoriteButton";
import { apiGet } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Movie, Review } from "@/lib/types";
import { formatSiteRating, minutesHuman, getProviderSearchUrl, isOwnedPlatform, movieStatus } from "@/lib/utils";

export default function MoviePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const mounted = useMounted();
  const {
    movieWatchlist,
    moviesWatched,
    moviesWatchedDates,
    movieCache,
    cacheMovie,
    toggleMovieWatchlist,
    toggleMovieWatched,
    localReviews,
    setLocalReview,
    favoriteMovies,
    toggleFavoriteMovie,
    myPlatforms,
  } = useTrack();

  const [fetched, setFetched] = useState<Movie | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [siteReviews, setSiteReviews] = useState<Review[]>([]);
  const [tmdbReviews, setTmdbReviews] = useState<Review[]>([]);
  const [reviewsTab, setReviewsTab] = useState<"site" | "tmdb">("site");
  const [tmdbLoading, setTmdbLoading] = useState(true);

  // Auto-bascule sur l'onglet TMDB s'il n'y a pas encore d'avis sur GlassTime
  useEffect(() => {
    if (!tmdbLoading && siteReviews.length === 0 && tmdbReviews.length > 0) {
      setReviewsTab("tmdb");
    }
  }, [siteReviews, tmdbReviews, tmdbLoading]);

  const [formRating, setFormRating] = useState<number>(5);
  const [formContent, setFormContent] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    apiGet<Movie>(`/api/movie/${id}`).then((data) => {
      if (cancelled) return;
      if (data) {
        setFetched(data);
        useTrack.getState().cacheMovie(data);
      } else setNotFound(true);
    });
    apiGet<Review[]>(`/api/reviews/movie/${id}?source=site`).then((data) => {
      if (cancelled) return;
      if (data) setSiteReviews(data);
    });
    setTmdbLoading(true);
    apiGet<Review[]>(`/api/reviews/movie/${id}?source=tmdb`).then((data) => {
      if (cancelled) return;
      if (data) setTmdbReviews(data);
      setTmdbLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      const response = await fetch(`/api/reviews/movie/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: formRating, content: formContent }),
      });

      if (response.ok) {
        const res = await apiGet<{ site: Review[]; tmdb: Review[] }>(`/api/reviews/movie/${id}`);
        if (res) {
          setSiteReviews(res.site ?? []);
        }
        setFormContent("");
      } else {
        const errData = await response.json();
        if (response.status === 401) {
          // Si non connecté (401), on enregistre localement en Zustand!
          setLocalReview("movie", id, formRating, formContent);
          setFormContent("");
        } else {
          setErrorMsg(errData.error || "Une erreur est survenue.");
        }
      }
    } catch (err) {
      // Échec réseau, on enregistre localement
      setLocalReview("movie", id, formRating, formContent);
      setFormContent("");
    } finally {
      setSubmitting(false);
    }
  }

  const movie = fetched ?? (mounted ? movieCache[id] : undefined);

  const myLocalReview = mounted ? localReviews[`movie-${id}`] : null;
  const hasLocalOnly = myLocalReview && !siteReviews.some((r) => r.id === "local-review");

  const displayedSiteReviews = [...siteReviews];
  if (hasLocalOnly && myLocalReview) {
    displayedSiteReviews.unshift({
      id: "local-review",
      author: "Vous (Local)",
      avatar: null,
      rating: myLocalReview.rating,
      content: myLocalReview.content,
      createdAt: myLocalReview.createdAt,
    });
  }

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
  const seenDate = mounted ? moviesWatchedDates[movie.id] : undefined;

  const heroBg = movie.poster
    ? `linear-gradient(180deg, var(--hero-veil-1), var(--hero-veil-2))`
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
        <FavoriteButton
          active={favoriteMovies.includes(movie.id)}
          onToggle={() => {
            const wasFavorite = favoriteMovies.includes(movie.id);
            cacheMovie(movie);
            toggleFavoriteMovie(movie.id);
            toast(
              wasFavorite ? "Retiré des favoris" : "Ajouté aux favoris",
              wasFavorite ? "💔" : "❤️"
            );
          }}
        />
        <div className="hero-poster">
          <Poster item={{ ...movie, status: movieStatus(inList, seen) }} />
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
                onClick={() => {
                  toggleMovieWatchlist(movie.id);
                  toast(
                    inList ? "Retiré de votre liste" : "Ajouté à votre liste à voir",
                    inList ? "↩️" : "🔖"
                  );
                }}
              >
                {inList ? "✓ À voir" : "+ À voir"}
              </button>
            )}
            <button
              className={`btn pressable ${seen ? "btn-success" : "btn-primary"}`}
              style={{ flex: 1 }}
              onClick={() => {
                toggleMovieWatched(movie.id);
                toast(
                  seen ? "Film marqué non vu" : `${movie.title} vu !`,
                  seen ? "↩️" : "🎬"
                );
              }}
            >
              {seen ? "✓ Vu" : "👁 Vu"}
            </button>
          </div>

          {seen && seenDate && (
            <p className="tiny" style={{ marginTop: 10 }}>
              📅 Vu le{" "}
              {new Date(seenDate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}

          {(movie.providers?.length ?? 0) > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="tiny" style={{ marginBottom: 8, fontWeight: 700 }}>
                OÙ REGARDER
              </div>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {[...movie.providers!]
                  .sort(
                    (a, b) =>
                      Number(isOwnedPlatform(myPlatforms, b.name)) -
                      Number(isOwnedPlatform(myPlatforms, a.name))
                  )
                  .map((p) => {
                    const searchUrl = getProviderSearchUrl(p.name, movie.title, p.link);
                    const owned = isOwnedPlatform(myPlatforms, p.name);
                    return (
                      <a
                        key={p.name}
                        href={searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`provider-pill${owned ? " owned" : ""}`}
                      >
                        {p.logo && <img src={p.logo} alt="" />}
                        {p.name}
                      </a>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Casting */}
      {(movie.cast?.length ?? 0) > 0 && (
        <>
          <h2 className="section-title">Casting</h2>
          <div className="cast-row">
            {movie.cast!.map((c) => (
              <div key={c.id} className="cast-member">
                {c.photo ? (
                  <img className="cast-photo" src={c.photo} alt={c.name} loading="lazy" />
                ) : (
                  <div className="cast-photo">🎭</div>
                )}
                <div className="name">{c.name}</div>
                {c.character && <div className="role">{c.character}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bande-annonce */}
      {movie.trailerKey && (
        <>
          <h2 className="section-title">Bande-annonce</h2>
          <div className="glass card" style={{ padding: 0, overflow: "hidden", marginBottom: 20, borderRadius: 16 }}>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${movie.trailerKey}?rel=0&modestbranding=1`}
                title={`Bande-annonce de ${movie.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Avis */}
      <h2 className="section-title">Avis</h2>

      {/* Formulaire de rédaction */}
      <div className="glass card" style={{ padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 12 }}>Rédiger mon avis</h3>
        <form onSubmit={handleReviewSubmit} className="stack" style={{ gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
              Note : {formRating} / 5
            </label>
            <div className="row" style={{ gap: 4 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormRating(star)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 20,
                    cursor: "pointer",
                    padding: 2,
                    filter: star <= formRating ? "none" : "grayscale(100%) opacity(30%)",
                    transition: "filter 0.15s",
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>
          <div>
            <textarea
              placeholder="Ajoutez un commentaire à votre note (facultatif)..."
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                background: "var(--glass-bg-strong)",
                border: "1px solid var(--glass-border)",
                borderRadius: 14,
                padding: "10px 14px",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                resize: "none",
              }}
            />
          </div>
          {errorMsg && (
            <div style={{ color: "var(--danger)", fontSize: 12.5, fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary pressable"
            style={{ padding: "8px 16px", alignSelf: "flex-end", fontSize: 13.5, borderRadius: 999 }}
          >
            {submitting ? "Publication..." : "Publier l'avis"}
          </button>
        </form>
      </div>

      {/* Onglets des avis */}
      <div className="glass segmented" style={{ marginBottom: 16 }}>
        <button
          className={reviewsTab === "site" ? "active" : ""}
          onClick={() => setReviewsTab("site")}
        >
          Avis GlassTime ({displayedSiteReviews.length})
        </button>
        <button
          className={reviewsTab === "tmdb" ? "active" : ""}
          onClick={() => setReviewsTab("tmdb")}
        >
          Avis TMDB ({tmdbLoading ? "..." : tmdbReviews.length})
        </button>
      </div>

      {/* Liste des avis filtrée */}
      {reviewsTab === "tmdb" && tmdbLoading ? (
        <div className="glass empty" style={{ padding: "32px 16px" }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }}></div>
          <p className="muted">Chargement des avis mondiaux...</p>
        </div>
      ) : (reviewsTab === "site" ? displayedSiteReviews : tmdbReviews).length === 0 ? (
        <div className="glass empty" style={{ padding: "24px 16px" }}>
          <p className="muted">
            {reviewsTab === "site"
              ? "Aucun avis rédigé sur GlassTime pour le moment."
              : "Aucun avis mondial disponible pour ce film."}
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12, marginBottom: 24 }}>
          {(reviewsTab === "site" ? displayedSiteReviews : tmdbReviews).map((r) => (
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
                    {reviewsTab === "site" ? `★ ${formatSiteRating(r.rating)}/5` : `★ ${r.rating.toFixed(0)}/10`}
                  </span>
                )}
              </div>
              {r.content && (
                <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                  {r.content.length > 350 ? `${r.content.slice(0, 350)}...` : r.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
