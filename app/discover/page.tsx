"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Poster from "@/components/Poster";
import BarcodeScanner from "@/components/BarcodeScanner";
import { apiGet, followShow } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import { toast } from "@/lib/toast";
import { minutesHuman } from "@/lib/utils";
import type { Book, Movie, Show } from "@/lib/types";

type MediaType = "shows" | "movies" | "books";

const PLACEHOLDERS: Record<MediaType, string> = {
  shows: "Rechercher une série…",
  movies: "Rechercher un film…",
  books: "Rechercher un titre, un auteur, un ISBN…",
};

export default function DiscoverPage() {
  const router = useRouter();
  const mounted = useMounted();
  const {
    followed,
    movieWatchlist,
    moviesWatched,
    booksWatchlist,
    booksRead,
    cacheMovie,
    cacheBook,
    toggleMovieWatchlist,
    toggleMovieWatched,
    toggleBookWatchlist,
    toggleBookRead,
  } = useTrack();

  const [type, setType] = useState<MediaType>("shows");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [showResults, setShowResults] = useState<Show[] | null>(null);
  const [movieResults, setMovieResults] = useState<Movie[] | null>(null);
  const [bookResults, setBookResults] = useState<Book[] | null>(null);
  const [showRecs, setShowRecs] = useState<Show[]>([]);
  const [movieRecs, setMovieRecs] = useState<Movie[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    apiGet<string[]>("/api/genres").then((g) => g && setGenres(g));
  }, []);

  // « Pour vous » : recommandations basées sur les suivis (une fois par visite)
  useEffect(() => {
    if (!mounted) return;
    const st = useTrack.getState();
    if (st.followed.length > 0) {
      apiGet<Show[]>(
        `/api/recommendations?type=tv&ids=${st.followed.slice(-4).join(",")}`
      ).then((r) => r && setShowRecs(r.filter((s) => !st.followed.includes(s.id))));
    }
    const movieSeeds = [...st.moviesWatched, ...st.movieWatchlist].slice(-4);
    if (movieSeeds.length > 0) {
      apiGet<Movie[]>(
        `/api/recommendations?type=movie&ids=${movieSeeds.join(",")}`
      ).then((r) => r && setMovieRecs(r));
    }
  }, [mounted]);

  const q = query.trim();
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        if (type === "shows") {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (genre) params.set("genre", genre);
          const data = await apiGet<Show[]>(`/api/shows?${params}`);
          if (!cancelled) setShowResults(data ?? []);
        } else if (type === "movies") {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          const data = await apiGet<Movie[]>(`/api/movies?${params}`);
          if (!cancelled) setMovieResults(data ?? []);
        } else {
          if (!q) {
            setBookResults(null);
            return;
          }
          const data = await apiGet<Book[]>(
            `/api/books?q=${encodeURIComponent(q)}`
          );
          if (!cancelled) setBookResults(data ?? []);
        }
      },
      q ? 350 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, q, genre]);

  function addMovieToWatchlist(m: Movie) {
    cacheMovie(m);
    toggleMovieWatchlist(m.id);
    if (!m.runtime)
      apiGet<Movie>(`/api/movie/${m.id}`).then((d) => d && cacheMovie(d));
    toast(`${m.title} ajouté à votre liste à voir`, "🔖");
  }

  function markMovieWatched(m: Movie) {
    cacheMovie(m);
    toggleMovieWatched(m.id);
    if (!m.runtime)
      apiGet<Movie>(`/api/movie/${m.id}`).then((d) => d && cacheMovie(d));
    toast(`${m.title} vu !`, "🎬");
  }

  function addBookToWatchlist(b: Book) {
    cacheBook(b);
    toggleBookWatchlist(b.id);
    toast(`${b.title} ajouté à votre liste à lire`, "📚");
  }

  function markBookRead(b: Book) {
    cacheBook(b);
    toggleBookRead(b.id);
    toast(`${b.title} lu !`, "📖");
  }

  function handleScanSuccess(book: Book) {
    cacheBook(book);
    setScannerOpen(false);
    router.push(`/book/${book.id}`);
  }

  const searching = q.length > 0 || (type === "shows" && genre !== null);
  const trending = (showResults ?? []).slice(0, 10);

  return (
    <main className="page">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Découvrir</h1>
          <p className="page-sub">Séries, films et livres</p>
        </div>
        {type === "books" && (
          <button
            className="btn btn-primary pressable row"
            style={{ padding: "10px 16px", borderRadius: 999, fontSize: 13.5, gap: 6, fontWeight: 700 }}
            onClick={() => setScannerOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
              <path d="M7 12h10" />
            </svg>
            Scanner
          </button>
        )}
      </div>

      <div className="glass segmented" style={{ marginBottom: 16 }}>
        <button
          className={type === "shows" ? "active" : ""}
          onClick={() => setType("shows")}
        >
          Séries
        </button>
        <button
          className={type === "movies" ? "active" : ""}
          onClick={() => setType("movies")}
        >
          Films
        </button>
        <button
          className={type === "books" ? "active" : ""}
          onClick={() => setType("books")}
        >
          Livres
        </button>
      </div>

      <div className="glass search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--text-3)" }}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          placeholder={PLACEHOLDERS[type]}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* ===== Séries ===== */}
      {type === "shows" && (
        <>
          <div className="hscroll" style={{ paddingBottom: 8 }}>
            {genres.map((g) => (
              <button
                key={g}
                className={`chip pressable${genre === g ? " active" : ""}`}
                style={{ width: "auto", minWidth: "auto" }}
                onClick={() => setGenre(genre === g ? null : g)}
              >
                {g}
              </button>
            ))}
          </div>

          {!searching && showRecs.length > 0 && (
            <>
              <h2 className="section-title">✨ Pour vous</h2>
              <div className="hscroll">
                {showRecs.map((s) => (
                  <Link key={s.id} href={`/show/${s.id}`} className="pressable">
                    <Poster item={s} />
                  </Link>
                ))}
              </div>
            </>
          )}

          {!searching && trending.length > 0 && (
            <>
              <h2 className="section-title">🔥 Tendances</h2>
              <div className="hscroll">
                {trending.map((s) => (
                  <Link key={s.id} href={`/show/${s.id}`} className="pressable">
                    <Poster item={s} />
                  </Link>
                ))}
              </div>
            </>
          )}

          <h2 className="section-title">
            {searching ? "Résultats" : "Séries populaires"}
            {showResults && <small>{showResults.length}</small>}
          </h2>

          {showResults === null ? (
            <div className="grid-posters">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton" style={{ aspectRatio: "2/3", borderRadius: 18 }} />
              ))}
            </div>
          ) : showResults.length === 0 ? (
            <div className="glass empty">
              <div className="big">🔍</div>
              <p className="muted">
                Aucune série ne correspond à votre recherche.
              </p>
            </div>
          ) : (
            <div className="grid-posters">
              {showResults.map((s) => {
                const isFollowed = mounted && followed.includes(s.id);
                return (
                  <div key={s.id} style={{ position: "relative" }}>
                    <Link
                      href={`/show/${s.id}`}
                      className="pressable"
                      style={{ display: "block" }}
                    >
                      <Poster item={s} />
                    </Link>
                    <button
                      className={`check small${isFollowed ? " checked" : ""}`}
                      style={{ position: "absolute", top: 8, right: 8 }}
                      aria-label={isFollowed ? "Ne plus suivre" : "Suivre"}
                      onClick={() => followShow(s)}
                    >
                      {isFollowed ? "✓" : "+"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== Films ===== */}
      {type === "movies" && (
        <>
          {!searching && movieRecs.length > 0 && (
            <>
              <h2 className="section-title">✨ Pour vous</h2>
              <div className="hscroll">
                {movieRecs.map((m) => (
                  <Link key={m.id} href={`/movie/${m.id}`} className="pressable">
                    <Poster item={m} />
                  </Link>
                ))}
              </div>
            </>
          )}

          <h2 className="section-title">
            {searching ? "Résultats" : "Films populaires"}
            {movieResults && <small>{movieResults.length}</small>}
          </h2>

          {movieResults === null ? (
            <div className="stack stack-wide">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 100 }} />
              ))}
            </div>
          ) : movieResults.length === 0 ? (
            <div className="glass empty">
              <div className="big">🎬</div>
              <p className="muted">
                Aucun film ne correspond à votre recherche.
              </p>
            </div>
          ) : (
            <div className="stack stack-wide">
              {movieResults.map((m) => {
                const inList = mounted && movieWatchlist.includes(m.id);
                const seen = mounted && moviesWatched.includes(m.id);
                const meta = [
                  m.year || null,
                  m.runtime ? minutesHuman(m.runtime) : null,
                  m.rating ? `★ ${m.rating.toFixed(1)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div key={m.id} className="glass card row">
                    <Link href={`/movie/${m.id}`} style={{ display: "flex", flexShrink: 0 }}>
                      <Poster item={m} mini />
                    </Link>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/movie/${m.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <div style={{ fontWeight: 700, fontSize: 15.5 }}>
                          {m.title}
                        </div>
                      </Link>
                      {meta && (
                        <div className="muted" style={{ marginTop: 2 }}>
                          {meta}
                        </div>
                      )}
                      {m.genres.length > 0 && (
                        <div className="tiny" style={{ marginTop: 2 }}>
                          {m.genres.slice(0, 3).join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      {!seen && (
                        <button
                          className={`check small${inList ? " checked" : ""}`}
                          aria-label="Liste à voir"
                          title="À voir"
                          onClick={() =>
                            inList
                              ? toggleMovieWatchlist(m.id)
                              : addMovieToWatchlist(m)
                          }
                        >
                          {inList ? "✓" : "+"}
                        </button>
                      )}
                      <button
                        className={`check${seen ? " checked" : ""}`}
                        aria-label="Marquer comme vu"
                        title="Vu"
                        onClick={() =>
                          seen ? toggleMovieWatched(m.id) : markMovieWatched(m)
                        }
                      >
                        👁
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===== Livres ===== */}
      {type === "books" && (
        <>
          <h2 className="section-title">
            Résultats
            {bookResults && <small>{bookResults.length}</small>}
          </h2>

          {bookResults === null ? (
            <div className="glass empty">
              <div className="big">📚</div>
              <p className="muted">
                Recherchez un livre par titre, auteur ou ISBN — ou scannez son
                code-barres.
              </p>
            </div>
          ) : bookResults.length === 0 ? (
            <div className="glass empty">
              <div className="big">🔍</div>
              <p className="muted">
                Aucun livre ne correspond à votre recherche.
              </p>
            </div>
          ) : (
            <div className="stack stack-wide">
              {bookResults.map((b) => {
                const inList = mounted && booksWatchlist.includes(b.id);
                const read = mounted && booksRead.includes(b.id);
                const meta = [
                  b.author,
                  b.year || null,
                  b.pages ? `${b.pages} p.` : null,
                  b.rating ? `★ ${b.rating.toFixed(1)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div key={b.id} className="glass card row">
                    <Link href={`/book/${b.id}`} style={{ display: "flex", flexShrink: 0 }}>
                      <Poster item={b} mini />
                    </Link>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/book/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <div style={{ fontWeight: 700, fontSize: 15.5 }}>
                          {b.title}
                        </div>
                      </Link>
                      {meta && (
                        <div className="muted" style={{ marginTop: 2, fontSize: 13 }}>
                          {meta}
                        </div>
                      )}
                      {b.genres.length > 0 && (
                        <div className="tiny" style={{ marginTop: 2 }}>
                          {b.genres.slice(0, 3).join(" · ")}
                        </div>
                      )}
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      {!read && (
                        <button
                          className={`check small${inList ? " checked" : ""}`}
                          aria-label="Liste à lire"
                          title="À lire"
                          onClick={() =>
                            inList
                              ? toggleBookWatchlist(b.id)
                              : addBookToWatchlist(b)
                          }
                        >
                          {inList ? "✓" : "+"}
                        </button>
                      )}
                      <button
                        className={`check${read ? " checked" : ""}`}
                        aria-label="Marquer comme lu"
                        title="Lu"
                        onClick={() =>
                          read ? toggleBookRead(b.id) : markBookRead(b)
                        }
                      >
                        📖
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {scannerOpen && (
        <BarcodeScanner
          onClose={() => setScannerOpen(false)}
          onSuccess={handleScanSuccess}
        />
      )}
    </main>
  );
}
