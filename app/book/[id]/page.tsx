"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Poster from "@/components/Poster";
import { apiGet, useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import type { Book, Review } from "@/lib/types";

export default function BookDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const id = params.id;

  const mounted = useMounted();
  const {
    booksWatchlist,
    booksRead,
    bookCache,
    booksProgress,
    cacheBook,
    toggleBookWatchlist,
    toggleBookRead,
    setBookProgress,
    localReviews,
    setLocalReview,
  } = useTrack();
  useHydrateLibrary();

  const [fetched, setFetched] = useState<Book | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [siteReviews, setSiteReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [formRating, setFormRating] = useState<number>(10);
  const [formContent, setFormContent] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    
    // Fetch book details
    apiGet<Book>(`/api/book/${id}`).then((data) => {
      if (cancelled) return;
      if (data) {
        setFetched(data);
        if (useTrack.getState().booksWatchlist.includes(data.id)) {
          useTrack.getState().cacheBook(data);
        }
      } else {
        setNotFound(true);
      }
    });

    // Fetch site reviews
    setReviewsLoading(true);
    apiGet<Review[]>(`/api/reviews/book/${id}?source=site`).then((data) => {
      if (cancelled) return;
      if (data) setSiteReviews(data);
      setReviewsLoading(false);
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
      const response = await fetch(`/api/reviews/book/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: formRating, content: formContent.trim() }),
      });

      if (!response.ok) {
        throw new Error("Erreur de sauvegarde");
      }

      const saved = await response.json();
      setSiteReviews((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
      setFormContent("");
    } catch (err) {
      console.warn("Sauvegarde de secours dans Zustand store (mode local) :", err);
      // Save local backup review
      setLocalReview("book", id, formRating, formContent.trim());
      setFormContent("");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) {
    return (
      <main className="page">
        <Link href="/books" className="btn btn-outline pressable back-btn">
          ← Retour
        </Link>
      </main>
    );
  }

  const book = fetched || bookCache[id];

  if (notFound) {
    return (
      <main className="page">
        <Link href="/books" className="btn btn-outline pressable back-btn">
          ← Retour
        </Link>
        <div className="glass empty">
          <div className="big">🕵️</div>
          <h2>Livre introuvable</h2>
          <p className="muted">Désolé, nous n'avons pas pu trouver ce livre.</p>
        </div>
      </main>
    );
  }

  if (!book) {
    return (
      <main className="page">
        <Link href="/books" className="btn btn-outline pressable back-btn">
          ← Retour
        </Link>
        <div className="glass empty">
          <div className="spinner" style={{ margin: "0 auto 12px" }}></div>
          <p className="muted">Chargement des informations du livre...</p>
        </div>
      </main>
    );
  }

  const isFollowed = booksWatchlist.includes(book.id);
  const isRead = booksRead.includes(book.id);

  const progress = booksProgress[book.id] ?? 0;
  const pagesTotal = book.pages ?? 0;
  const pct = pagesTotal > 0 ? Math.min(Math.round((progress / pagesTotal) * 100), 100) : 0;

  // Merge local reviews backup in state list
  const myLocalReview = localReviews[`book-${book.id}`];
  const hasLocalOnly = myLocalReview && !siteReviews.some((r) => r.id === "local-review");

  const displayedReviews = [...siteReviews];
  if (hasLocalOnly && myLocalReview) {
    displayedReviews.unshift({
      id: "local-review",
      author: "Vous (Local)",
      rating: myLocalReview.rating,
      content: myLocalReview.content,
      createdAt: myLocalReview.createdAt,
    });
  }

  return (
    <main className="page" style={{ paddingBottom: 100 }}>
      <Link href="/books" className="btn btn-outline pressable back-btn">
        ← Retour
      </Link>

      {/* Hero Banner */}
      <div className="glass show-hero" style={{ marginTop: 14, marginBottom: 20 }}>
        <div className="hero-poster">
          <Poster item={book} />
        </div>
        <div className="hero-body">
          <h1 style={{ fontSize: 25, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 14 }}>
            {book.title}
          </h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
            {[
              book.author,
              book.year || null,
              book.pages ? `${book.pages} pages` : null,
              book.rating ? `★ ${book.rating.toFixed(1)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {book.genres && book.genres.length > 0 && (
            <p className="tiny" style={{ marginTop: 4 }}>
              {book.genres.join(" · ")}
            </p>
          )}
          {book.overview && (
            <p className="muted" style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.5, textAlign: "left", maxHeight: 120, overflowY: "auto" }}>
              {book.overview}
            </p>
          )}

          <div className="row" style={{ marginTop: 18, gap: 10 }}>
            <button
              className={`btn pressable ${isFollowed ? "btn-success" : "btn-primary"}`}
              style={{ flex: 1 }}
              onClick={() => toggleBookWatchlist(book.id)}
            >
              {isFollowed ? "✓ Suivi" : "+ Suivre"}
            </button>
            <button
              className={`btn pressable ${isRead ? "btn-success" : "btn-outline"}`}
              style={{ flex: 1 }}
              onClick={() => toggleBookRead(book.id)}
            >
              {isRead ? "✓ Lu" : "Marquer comme lu"}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Tracker Section */}
      {isFollowed && !isRead && (
        <div className="glass card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Votre progression de lecture</h3>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="row" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 14 }}>Page</span>
              <input
                type="number"
                min="0"
                max={pagesTotal > 0 ? pagesTotal : undefined}
                value={progress}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value));
                  setBookProgress(book.id, pagesTotal > 0 ? Math.min(val, pagesTotal) : val);
                }}
                style={{
                  width: 70,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1.5px solid var(--glass-border)",
                  background: "var(--glass-bg-strong)",
                  color: "var(--text)",
                  textAlign: "center",
                  fontWeight: 700,
                  outline: "none",
                }}
              />
              <span className="muted" style={{ fontSize: 14 }}>sur {pagesTotal > 0 ? pagesTotal : "?"}</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{pct}% lu</span>
          </div>

          {pagesTotal > 0 && (
            <div style={{ marginTop: 8 }}>
              <input
                type="range"
                min="0"
                max={pagesTotal}
                value={progress}
                onChange={(e) => setBookProgress(book.id, Number(e.target.value))}
                style={{
                  width: "100%",
                  height: 6,
                  borderRadius: 999,
                  background: "var(--glass-border)",
                  outline: "none",
                  cursor: "pointer",
                  accentColor: "#bf5af2",
                }}
              />
              <div className="progress" style={{ height: 6, marginTop: 12 }}>
                <div style={{ width: `${pct}%`, background: "linear-gradient(90deg, #bf5af2, #0a84ff)" }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reviews Form */}
      <div className="glass card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Rédiger mon avis</h3>
        <form onSubmit={handleReviewSubmit} className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div className="row" style={{ gap: 4 }}>
              <span className="muted">Note :</span>
              <span style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>
                {formRating} / 10
              </span>
            </div>
            <div className="row" style={{ gap: 2 }}>
              {Array.from({ length: 10 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFormRating(i + 1)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "2px 1px",
                    fontSize: 20,
                    cursor: "pointer",
                    transition: "transform 0.1s",
                    transform: formRating >= i + 1 ? "scale(1.1)" : "scale(1)",
                  }}
                >
                  {formRating >= i + 1 ? "★" : "☆"}
                </button>
              ))}
            </div>
          </div>

          <textarea
            placeholder="Ajoutez un commentaire à votre note (facultatif)..."
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            style={{
              width: "100%",
              minHeight: 80,
              padding: 12,
              borderRadius: 12,
              border: "1.5px solid var(--glass-border)",
              background: "var(--glass-bg)",
              color: "var(--text)",
              outline: "none",
              fontSize: 14,
              resize: "vertical",
            }}
          />

          {errorMsg && (
            <div style={{ color: "#ff6b6b", fontSize: 12.5, fontWeight: 600 }}>
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

      {/* Reviews list title */}
      <h3 className="section-title">Avis des lecteurs</h3>

      {reviewsLoading ? (
        <div className="glass empty" style={{ padding: "32px 16px" }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }}></div>
          <p className="muted">Chargement des avis...</p>
        </div>
      ) : displayedReviews.length === 0 ? (
        <div className="glass empty" style={{ padding: "24px 16px" }}>
          <p className="muted">Aucun avis rédigé sur ce livre pour le moment.</p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12, marginBottom: 24 }}>
          {displayedReviews.map((r) => (
            <div key={r.id} className="glass card" style={{ padding: 18 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, alignItems: "flex-start" }}>
                <div className="row" style={{ gap: 10 }}>
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
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{r.author}</div>
                    <div className="tiny" style={{ fontSize: 11 }}>
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""}
                    </div>
                  </div>
                </div>

                {r.rating && (
                  <span className="badge-pill" style={{ color: "#ffb800", borderColor: "rgba(255, 184, 0, 0.25)", background: "rgba(255, 184, 0, 0.08)" }}>
                    ★ {r.rating}/10
                  </span>
                )}
              </div>
              {r.content && (
                <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, marginTop: 6, whiteSpace: "pre-wrap" }}>
                  {r.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
