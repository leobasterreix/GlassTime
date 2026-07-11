"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Poster from "@/components/Poster";
import FavoriteButton from "@/components/FavoriteButton";
import { apiGet, useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import { toast } from "@/lib/toast";
import type { Book, Review } from "@/lib/types";
import { bookStatus } from "@/lib/utils";

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
    booksReadDates,
    bookCache,
    cacheBook,
    toggleBookWatchlist,
    toggleBookRead,
    setBookReadDate,
    localReviews,
    setLocalReview,
    favoriteBooks,
    toggleFavoriteBook,
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

  const storedDate = booksReadDates[id] ?? "";
  let initialPrecision: "date" | "month" | "year" = "date";
  if (storedDate.length === 7) initialPrecision = "month";
  else if (storedDate.length === 4) initialPrecision = "year";

  const [precision, setPrecision] = useState<"date" | "month" | "year">(initialPrecision);

  const handlePrecisionChange = (newPrec: "date" | "month" | "year") => {
    setPrecision(newPrec);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    if (newPrec === "date") {
      if (storedDate.length === 7) {
        setBookReadDate(id, `${storedDate}-01`);
      } else if (storedDate.length === 4) {
        setBookReadDate(id, `${storedDate}-01-01`);
      } else {
        setBookReadDate(id, `${yyyy}-${mm}-${dd}`);
      }
    } else if (newPrec === "month") {
      if (storedDate.length === 10) {
        setBookReadDate(id, storedDate.slice(0, 7));
      } else if (storedDate.length === 4) {
        setBookReadDate(id, `${storedDate}-01`);
      } else {
        setBookReadDate(id, `${yyyy}-${mm}`);
      }
    } else if (newPrec === "year") {
      if (storedDate.length >= 7) {
        setBookReadDate(id, storedDate.slice(0, 4));
      } else {
        setBookReadDate(id, String(yyyy));
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    
    // Fetch book details
    apiGet<Book>(`/api/book/${id}`).then((data) => {
      if (cancelled) return;
      if (data) {
        setFetched(data);
        const state = useTrack.getState();
        if (state.booksWatchlist.includes(data.id) || state.booksRead.includes(data.id)) {
          state.cacheBook(data);
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

      if (response.ok) {
        const res = await apiGet<Review[]>(`/api/reviews/book/${id}?source=site`);
        if (res) setSiteReviews(res);
        setFormContent("");
      } else {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          // Pas connecté : comportement attendu, on sauvegarde localement sans bruit.
          setLocalReview("book", id, formRating, formContent.trim());
          setFormContent("");
        } else {
          // Vraie erreur serveur (ex. colonne item_id incompatible) : on la
          // montre au lieu de la masquer derrière une sauvegarde locale muette.
          setErrorMsg(errData.error || "Une erreur est survenue.");
        }
      }
    } catch (err) {
      // Échec réseau : on sauvegarde localement en secours.
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
        <FavoriteButton
          active={favoriteBooks.includes(book.id)}
          onToggle={() => {
            const wasFavorite = favoriteBooks.includes(book.id);
            cacheBook(book);
            toggleFavoriteBook(book.id);
            toast(
              wasFavorite ? "Retiré des favoris" : "Ajouté aux favoris",
              wasFavorite ? "💔" : "❤️"
            );
          }}
        />
        <div className="hero-poster">
          <Poster item={{ ...book, status: bookStatus(isFollowed, isRead) }} />
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
              onClick={() => {
                cacheBook(book);
                toggleBookWatchlist(book.id);
              }}
            >
              {isFollowed ? "✓ Suivi" : "+ Suivre"}
            </button>
            <button
              className={`btn pressable ${isRead ? "btn-success" : "btn-outline"}`}
              style={{ flex: 1 }}
              onClick={() => {
                cacheBook(book);
                toggleBookRead(book.id);
              }}
            >
              {isRead ? "✓ Lu" : "Marquer comme lu"}
            </button>
          </div>
        </div>
      </div>

      {/* Date de lecture (si lu) */}
      {isRead && (
        <div className="glass card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Informations de lecture</h3>
          
          <div className="segmented animate-fade-in" style={{ marginBottom: 16, background: "var(--glass-bg-strong)", padding: 3 }}>
            <button
              type="button"
              className={precision === "date" ? "active" : ""}
              onClick={() => handlePrecisionChange("date")}
              style={{ padding: "6px 0", fontSize: 12.5 }}
            >
              Date exacte
            </button>
            <button
              type="button"
              className={precision === "month" ? "active" : ""}
              onClick={() => handlePrecisionChange("month")}
              style={{ padding: "6px 0", fontSize: 12.5 }}
            >
              Mois
            </button>
            <button
              type="button"
              className={precision === "year" ? "active" : ""}
              onClick={() => handlePrecisionChange("year")}
              style={{ padding: "6px 0", fontSize: 12.5 }}
            >
              Année
            </button>
          </div>

          <div className="row" style={{ gap: 12, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 14 }}>Date de lecture :</span>
            
            {precision === "date" && (
              <input
                type="date"
                value={storedDate.length === 10 ? storedDate : ""}
                onChange={(e) => setBookReadDate(book.id, e.target.value || null)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1.5px solid var(--glass-border)",
                  background: "var(--glass-bg-strong)",
                  color: "var(--text)",
                  fontWeight: 600,
                  outline: "none",
                }}
              />
            )}

            {precision === "month" && (
              <input
                type="month"
                value={storedDate.length === 7 ? storedDate : ""}
                onChange={(e) => setBookReadDate(book.id, e.target.value || null)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1.5px solid var(--glass-border)",
                  background: "var(--glass-bg-strong)",
                  color: "var(--text)",
                  fontWeight: 600,
                  outline: "none",
                }}
              />
            )}

            {precision === "year" && (
              <input
                type="number"
                min="1900"
                max="2100"
                placeholder="Ex: 2026"
                value={storedDate.length === 4 ? storedDate : ""}
                onChange={(e) => setBookReadDate(book.id, e.target.value || null)}
                style={{
                  width: 100,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1.5px solid var(--glass-border)",
                  background: "var(--glass-bg-strong)",
                  color: "var(--text)",
                  fontWeight: 600,
                  outline: "none",
                  textAlign: "center",
                }}
              />
            )}
          </div>
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
                  className="pressable"
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
