"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Poster from "@/components/Poster";
import FavoriteButton from "@/components/FavoriteButton";
import { apiGet, followShow } from "@/lib/client";
import { useMounted, useTrack, type ShowFollowStatus } from "@/lib/store";
import { toast } from "@/lib/toast";
import { markEpisodeWatched, markWatchedUpTo } from "@/lib/watch";
import type { Episode, Show, Review } from "@/lib/types";
import {
  airedEpisodes,
  epKey,
  epLabel,
  fmtDate,
  fmtRelative,
  isAired,
  watchedCount,
  getProviderSearchUrl,
} from "@/lib/utils";

const STATUS_LABELS: { value: ShowFollowStatus; label: string }[] = [
  { value: "active", label: "En cours" },
  { value: "paused", label: "En pause" },
  { value: "dropped", label: "Abandonnée" },
];

export default function ShowPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const mounted = useMounted();
  const {
    followed,
    watched,
    showCache,
    cacheShow,
    setEpisode,
    setEpisodes,
    localReviews,
    setLocalReview,
    showStatus,
    setShowStatus,
    favoriteShows,
    toggleFavoriteShow,
  } = useTrack();
  // Proposition de rattrapage après avoir coché un épisode « en avance »
  const [catchUp, setCatchUp] = useState<{ ep: Episode; count: number } | null>(null);

  const [fetched, setFetched] = useState<Show | null>(null);
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

  const [formRating, setFormRating] = useState<number>(10);
  const [formContent, setFormContent] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

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
    apiGet<Review[]>(`/api/reviews/show/${id}?source=site`).then((data) => {
      if (cancelled) return;
      if (data) setSiteReviews(data);
    });
    setTmdbLoading(true);
    apiGet<Review[]>(`/api/reviews/show/${id}?source=tmdb`).then((data) => {
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
      const response = await fetch(`/api/reviews/show/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: formRating, content: formContent }),
      });

      if (response.ok) {
        const res = await apiGet<{ site: Review[]; tmdb: Review[] }>(`/api/reviews/show/${id}`);
        if (res) {
          setSiteReviews(res.site ?? []);
        }
        setFormContent("");
      } else {
        const errData = await response.json();
        if (response.status === 401) {
          // Si non connecté (401), on enregistre localement en Zustand!
          setLocalReview("show", id, formRating, formContent);
          setFormContent("");
        } else {
          setErrorMsg(errData.error || "Une erreur est survenue.");
        }
      }
    } catch (err) {
      // Échec réseau, on enregistre localement
      setLocalReview("show", id, formRating, formContent);
      setFormContent("");
    } finally {
      setSubmitting(false);
    }
  }

  const show = fetched ?? (mounted ? showCache[id] : undefined);

  const myLocalReview = mounted ? localReviews[`show-${id}`] : null;
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

  if (!show) {
    return (
      <main className="page">
        <button className="chip pressable" onClick={() => router.back()} style={{ marginBottom: 16 }}>
          ← Retour
        </button>
        {notFound ? (
          <div className="glass empty">
            <div className="big">🫥</div>
            <p className="muted">Série introuvable.</p>
          </div>
        ) : (
          <>
            <div className="skeleton" style={{ height: 230, borderRadius: 24, marginBottom: 20 }} />
            <div className="skeleton skeleton-line" style={{ width: "45%" }} />
            <div className="stack" style={{ marginTop: 16 }}>
              <div className="skeleton" style={{ height: 56 }} />
              <div className="skeleton" style={{ height: 56 }} />
              <div className="skeleton" style={{ height: 56 }} />
            </div>
          </>
        )}
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
    ? `linear-gradient(180deg, var(--hero-veil-1), var(--hero-veil-2)), url(${show.backdrop}) center/cover`
    : show.colors
      ? `linear-gradient(170deg, ${show.colors[1]}55, ${show.colors[0]}33)`
      : undefined;

  const currentStatus: ShowFollowStatus = showStatus[show.id] ?? "active";

  function onEpisodeCheck(ep: Episode, seen_: boolean) {
    if (!show) return;
    if (seen_) {
      setEpisode(show.id, ep.s, ep.e, false);
      setCatchUp(null);
      return;
    }
    const unseenBefore = markEpisodeWatched(show, ep);
    if (unseenBefore > 0) setCatchUp({ ep, count: unseenBefore });
    else setCatchUp(null);
  }

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
          active={favoriteShows.includes(show.id)}
          onToggle={() => {
            const wasFavorite = favoriteShows.includes(show.id);
            cacheShow(show);
            toggleFavoriteShow(show.id);
            toast(
              wasFavorite ? "Retiré des favoris" : "Ajouté aux favoris",
              wasFavorite ? "💔" : "❤️"
            );
          }}
        />
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
            onClick={() => {
              setEpisodes(
                show.id,
                aired.map(({ s, e }) => ({ s, e })),
                !allSeen
              );
              toast(
                allSeen
                  ? "Série marquée non vue"
                  : `${show.title} entièrement vue !`,
                allSeen ? "↩️" : "🏆"
              );
            }}
          >
            {allSeen ? "Tout marquer non vu" : "Tout marquer vu"}
          </button>
        </div>

        {isFollowed && (
          <div className="glass segmented" style={{ marginTop: 12 }}>
            {STATUS_LABELS.map((s) => (
              <button
                key={s.value}
                className={currentStatus === s.value ? "active" : ""}
                onClick={() => {
                  setShowStatus(show.id, s.value);
                  toast(
                    s.value === "active"
                      ? "Série reprise dans l'agenda"
                      : s.value === "paused"
                        ? "Série mise en pause"
                        : "Série abandonnée — retirée de l'agenda",
                    s.value === "active" ? "▶️" : s.value === "paused" ? "⏸️" : "🗑️"
                  );
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {(show.providers?.length ?? 0) > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="tiny" style={{ marginBottom: 8, fontWeight: 700 }}>
              OÙ REGARDER
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {show.providers!.map((p) => {
                const searchUrl = getProviderSearchUrl(p.name, show.title, p.link);
                return (
                  <a
                    key={p.name}
                    href={searchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="provider-pill"
                  >
                    {p.logo && <img src={p.logo} alt="" />}
                    {p.name}
                  </a>
                );
              })}
            </div>
          </div>
        )}

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

      {/* Casting */}
      {(show.cast?.length ?? 0) > 0 && (
        <>
          <h2 className="section-title">Casting</h2>
          <div className="cast-row">
            {show.cast!.map((c) => (
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
      {show.trailerKey && (
        <>
          <h2 className="section-title">Bande-annonce</h2>
          <div className="glass card" style={{ padding: 0, overflow: "hidden", marginBottom: 20, borderRadius: 16 }}>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${show.trailerKey}?rel=0&modestbranding=1`}
                title={`Bande-annonce de ${show.title}`}
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
                          onClick={() => onEpisodeCheck(ep, seen_)}
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

      {/* Formulaire de rédaction */}
      <div className="glass card" style={{ padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 12 }}>Rédiger mon avis</h3>
        <form onSubmit={handleReviewSubmit} className="stack" style={{ gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
              Note : {formRating} / 10
            </label>
            <div className="row" style={{ gap: 4 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
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
              : "Aucun avis mondial disponible pour cette série."}
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
                    ★ {r.rating.toFixed(0)}/10
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

      {/* Proposition de rattrapage « marquer vu jusqu'ici » */}
      {catchUp && (
        <div className="toaster" style={{ pointerEvents: "auto" }}>
          <div
            className="toast glass glass-strong"
            style={{ borderRadius: 20, flexWrap: "wrap", justifyContent: "center" }}
          >
            <span>
              ⏩ Marquer aussi les {catchUp.count} épisode
              {catchUp.count > 1 ? "s" : ""} précédent
              {catchUp.count > 1 ? "s" : ""} ?
            </span>
            <span className="row" style={{ gap: 8 }}>
              <button
                className="chip pressable active"
                onClick={() => {
                  markWatchedUpTo(show, catchUp.ep);
                  setCatchUp(null);
                }}
              >
                Oui, tout vu jusqu'à {epLabel(catchUp.ep)}
              </button>
              <button
                className="chip pressable"
                onClick={() => setCatchUp(null)}
              >
                Non
              </button>
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
