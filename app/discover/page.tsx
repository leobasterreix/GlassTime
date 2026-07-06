"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Poster from "@/components/Poster";

// html5-qrcode est une dépendance lourde (moteur de décodage QR/EAN) : on ne
// la charge que lorsque le scanner est réellement ouvert, pas dans le bundle
// initial de la page Découvrir.
const BarcodeScanner = dynamic(() => import("@/components/BarcodeScanner"), {
  ssr: false,
});
import { apiGet, followShow } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import { toast } from "@/lib/toast";
import { bookStatus, minutesHuman, movieStatus } from "@/lib/utils";
import type { Book, Movie, Show } from "@/lib/types";

type MediaType = "shows" | "movies" | "books";

const MONTHS = [
  { value: "01", label: "Janvier" },
  { value: "02", label: "Février" },
  { value: "03", label: "Mars" },
  { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },
  { value: "08", label: "Août" },
  { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1900 + 1 }, (_, i) => CURRENT_YEAR - i);

export default function DiscoverPage() {
  return (
    <Suspense>
      <DiscoverContent />
    </Suspense>
  );
}

function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useMounted();
  const {
    followed,
    showCache,
    showStatus,
    movieWatchlist,
    moviesWatched,
    booksWatchlist,
    booksRead,
    bookCache,
    cacheMovie,
    cacheBook,
    toggleMovieWatchlist,
    toggleMovieWatched,
    toggleBookWatchlist,
    toggleBookRead,
    discoverPrefs,
    setDiscoverPrefs,
  } = useTrack();

  const [type, setType] = useState<MediaType>(
    () => (searchParams.get("type") as MediaType) || discoverPrefs.type
  );
  const [query, setQuery] = useState(() => searchParams.get("q") ?? discoverPrefs.query);
  const [genre, setGenre] = useState<string | null>(
    () => searchParams.get("genre") ?? discoverPrefs.genre
  );
  const [bookGenre, setBookGenre] = useState<string | null>(
    () => searchParams.get("bgenre") ?? discoverPrefs.bookGenre
  );
  const [bookYear, setBookYear] = useState<string | null>(
    () => searchParams.get("byear") ?? discoverPrefs.bookYear
  );
  const [bookMonth, setBookMonth] = useState<string | null>(
    () => searchParams.get("bmonth") ?? discoverPrefs.bookMonth
  );
  const [genres, setGenres] = useState<string[]>([]);
  const [showResults, setShowResults] = useState<Show[] | null>(null);
  const [movieResults, setMovieResults] = useState<Movie[] | null>(null);
  const [bookResults, setBookResults] = useState<Book[] | null>(null);
  const [showRecs, setShowRecs] = useState<Show[]>([]);
  const [showStatusExtra, setShowStatusExtra] = useState<Record<number, "En cours" | "Terminée">>({});
  const [movieRecs, setMovieRecs] = useState<Movie[]>([]);
  const [bookRecs, setBookRecs] = useState<Book[]>([]);
  const [bookTrending, setBookTrending] = useState<Book[] | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    apiGet<string[]>("/api/genres").then((g) => g && setGenres(g));
  }, []);

  // Persiste type/recherche/genre à la fois dans l'URL (retour navigateur
  // depuis une fiche) et dans le store (survit aussi à un changement d'onglet
  // de la barre de navigation, qui lui repart d'une URL /discover nue).
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("type", type);
    if (query) params.set("q", query);
    if (type === "shows" && genre) params.set("genre", genre);
    if (type === "books" && bookGenre) params.set("bgenre", bookGenre);
    if (type === "books" && bookYear) params.set("byear", bookYear);
    if (type === "books" && bookYear && bookMonth) params.set("bmonth", bookMonth);
    const qs = params.toString();
    router.replace(qs ? `/discover?${qs}` : "/discover", { scroll: false });
    setDiscoverPrefs({ type, query, genre, bookGenre, bookYear, bookMonth });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, query, genre, bookGenre, bookYear, bookMonth]);

  // Recommendations: based on followed items
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

  // Recommandations livres : pas d'API dédiée côté OpenLibrary, donc dérivées
  // du genre le plus fréquent parmi les livres déjà suivis/lus.
  const bookTopGenre = useMemo(() => {
    if (!mounted) return null;
    const counts = new Map<string, number>();
    for (const id of [...booksRead, ...booksWatchlist]) {
      const b = bookCache[id];
      if (!b) continue;
      for (const g of b.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    if (counts.size === 0) return null;
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }, [mounted, booksRead, booksWatchlist, bookCache]);

  useEffect(() => {
    if (!bookTopGenre) {
      setBookRecs([]);
      return;
    }
    apiGet<Book[]>(`/api/books?subject=${encodeURIComponent(bookTopGenre)}`).then((d) => {
      if (!d) return;
      const tracked = new Set([...booksRead, ...booksWatchlist]);
      setBookRecs(d.filter((b) => !tracked.has(b.id)).slice(0, 10));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookTopGenre]);

  // Tendances livres : proposées par défaut, avant toute recherche.
  useEffect(() => {
    if (type !== "books" || bookTrending !== null) return;
    apiGet<Book[]>("/api/books/trending").then((d) => d && setBookTrending(d));
  }, [type, bookTrending]);

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
          if (!q && !bookYear) {
            setBookResults(null);
            return;
          }
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (bookYear) params.set("year", bookYear);
          if (bookYear && bookMonth) params.set("month", bookMonth);
          const data = await apiGet<Book[]>(`/api/books?${params}`);
          if (!cancelled) setBookResults(data ?? []);
        }
      },
      q ? 220 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, q, genre, bookYear, bookMonth]);

  // Bandeau de statut sur les séries pas encore suivies : les listes TMDB ne
  // renvoient pas ce champ, on le récupère à part (appel léger, sans
  // saisons/casting) pour les séries visibles qu'on n'a pas déjà en cache.
  useEffect(() => {
    if (type !== "shows") return;
    const cache = useTrack.getState().showCache;
    const ids = [...new Set([...showRecs, ...(showResults ?? [])].map((s) => s.id))].filter(
      (id) => !cache[id] && !(id in showStatusExtra)
    );
    if (ids.length === 0) return;
    apiGet<Record<number, "En cours" | "Terminée">>(`/api/shows-status?ids=${ids.join(",")}`).then(
      (d) => d && setShowStatusExtra((prev) => ({ ...prev, ...d }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, showRecs, showResults]);

  // Pas d'API de genres pour les livres (OpenLibrary ne fournit que des
  // « subjects » bruts par résultat) : on dérive des chips à partir des
  // résultats de recherche courants, pour filtrer côté client.
  const bookGenres = useMemo(() => {
    if (!bookResults) return [];
    const counts = new Map<string, number>();
    for (const b of bookResults) {
      for (const g of b.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([g]) => g);
  }, [bookResults]);

  const filteredBookResults = useMemo(() => {
    if (!bookResults) return bookResults;
    if (!bookGenre) return bookResults;
    return bookResults.filter((b) => b.genres.includes(bookGenre));
  }, [bookResults, bookGenre]);

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

  const handleTypeChange = (newType: MediaType) => {
    setType(newType);
    setQuery("");
    setGenre(null);
    setBookGenre(null);
    setBookYear(null);
    setBookMonth(null);
  };

  const searching = q.length > 0 || (type === "shows" && genre !== null);
  const browsingBooks = q.length > 0 || bookYear !== null;

  /** Statut d'affichage (bandeau) pour une série : les listes TMDB
   * (recherche/tendances/populaires) ne renvoient pas le statut de
   * diffusion, contrairement à la fiche complète — showStatusExtra comble
   * ce trou via un appel léger dédié (voir l'effet ci-dessous), pour que le
   * bandeau apparaisse aussi sur les séries pas encore suivies. */
  function showBandStatus(s: Show) {
    if (showStatus[s.id] === "dropped") return "Abandonnée" as const;
    const cached = showCache[s.id];
    if (cached?.status) return cached.status;
    return showStatusExtra[s.id];
  }

  function bookPosterRow(b: Book) {
    const inList = mounted && booksWatchlist.includes(b.id);
    const read = mounted && booksRead.includes(b.id);
    return (
      <div key={b.id} style={{ position: "relative", flexShrink: 0 }}>
        <Link href={`/book/${b.id}`} className="pressable">
          <Poster item={{ ...b, status: bookStatus(inList, read) }} />
        </Link>
        {!read && (
          <button
            className={`check small${inList ? " checked" : ""}`}
            style={{ position: "absolute", top: 8, right: 8 }}
            aria-label={inList ? "Retirer de la liste à lire" : "Ajouter à la liste à lire"}
            onClick={() => (inList ? toggleBookWatchlist(b.id) : addBookToWatchlist(b))}
          >
            {inList ? "✓" : "+"}
          </button>
        )}
      </div>
    );
  }

  return (
    <main className="page" style={{ paddingTop: 0 }}>
      {/* En-tête collant (sticky) : Titre, Catégories, Barre de recherche et Filtres */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--tab-bg)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: 12,
          borderBottom: "1px solid var(--hairline)",
          margin: "0 -18px 16px -18px",
          paddingLeft: 18,
          paddingRight: 18,
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: 28 }}>Découvrir</h1>
            <p className="page-sub" style={{ margin: 0, marginTop: 2 }}>Séries, films et livres</p>
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

        <div className="glass segmented" style={{ marginBottom: 12 }}>
          <button
            className={type === "shows" ? "active" : ""}
            onClick={() => handleTypeChange("shows")}
          >
            Séries 📺
          </button>
          <button
            className={type === "movies" ? "active" : ""}
            onClick={() => handleTypeChange("movies")}
          >
            Films 🎬
          </button>
          <button
            className={type === "books" ? "active" : ""}
            onClick={() => handleTypeChange("books")}
          >
            Livres 📚
          </button>
        </div>

        <div className="search" style={{ marginBottom: (type === "shows" && genres.length > 0) || type === "books" ? 12 : 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--text-3)" }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            placeholder={
              type === "shows"
                ? "Rechercher une série…"
                : type === "movies"
                  ? "Rechercher un film…"
                  : "Rechercher un titre, un auteur, un ISBN…"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {type === "shows" && genres.length > 0 && (
          <div className="hscroll" style={{ paddingBottom: 0, marginBottom: 0 }}>
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
        )}

        {type === "books" && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <select
                className="select"
                value={bookYear ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setBookYear(v);
                  if (!v) setBookMonth(null);
                }}
              >
                <option value="">Année</option>
                {YEARS.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={bookMonth ?? ""}
                disabled={!bookYear}
                onChange={(e) => setBookMonth(e.target.value || null)}
              >
                <option value="">Mois</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {(bookYear || bookMonth) && (
                <button
                  className="chip pressable"
                  style={{ width: "auto", minWidth: "auto" }}
                  onClick={() => {
                    setBookYear(null);
                    setBookMonth(null);
                  }}
                >
                  ✕ Effacer
                </button>
              )}
            </div>

            {bookGenres.length > 0 && (
              <div className="hscroll" style={{ paddingBottom: 0, marginBottom: 0 }}>
                {bookGenres.map((g) => (
                  <button
                    key={g}
                    className={`chip pressable${bookGenre === g ? " active" : ""}`}
                    style={{ width: "auto", minWidth: "auto" }}
                    onClick={() => setBookGenre(bookGenre === g ? null : g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. SÉRIES RESULTS */}
      {type === "shows" && (
        <>
          {!searching && showRecs.length > 0 && (
            <>
              <h2 className="section-title">✨ Pour vous</h2>
              <div className="hscroll" style={{ marginBottom: 20 }}>
                {showRecs.map((s) => {
                  const isFollowed = mounted && followed.includes(s.id);
                  return (
                    <div key={s.id} style={{ position: "relative", flexShrink: 0 }}>
                      <Link href={`/show/${s.id}`} className="pressable">
                        <Poster item={{ ...s, status: showBandStatus(s) }} />
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
            </>
          )}

          {!searching && showResults && showResults.length > 0 && (
            <>
              <h2 className="section-title">🔥 Tendances</h2>
              <div className="hscroll" style={{ marginBottom: 20 }}>
                {showResults.slice(0, 10).map((s) => {
                  const isFollowed = mounted && followed.includes(s.id);
                  return (
                    <div key={s.id} style={{ position: "relative", flexShrink: 0 }}>
                      <Link href={`/show/${s.id}`} className="pressable">
                        <Poster item={{ ...s, status: showBandStatus(s) }} />
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
              <p className="muted">Aucune série ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className="grid-posters">
              {showResults.map((s) => {
                const isFollowed = mounted && followed.includes(s.id);
                return (
                  <div key={s.id} style={{ position: "relative" }}>
                    <Link href={`/show/${s.id}`} className="pressable" style={{ display: "block" }}>
                      <Poster item={{ ...s, status: showBandStatus(s) }} />
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

      {/* 2. FILMS RESULTS */}
      {type === "movies" && (
        <>
          {!searching && movieRecs.length > 0 && (
            <>
              <h2 className="section-title">✨ Pour vous</h2>
              <div className="hscroll" style={{ marginBottom: 20 }}>
                {movieRecs.map((m) => {
                  const inList = mounted && movieWatchlist.includes(m.id);
                  const seen = mounted && moviesWatched.includes(m.id);
                  return (
                    <div key={m.id} style={{ position: "relative", flexShrink: 0 }}>
                      <Link href={`/movie/${m.id}`} className="pressable">
                        <Poster item={{ ...m, status: movieStatus(inList, seen) }} />
                      </Link>
                      {!seen && (
                        <button
                          className={`check small${inList ? " checked" : ""}`}
                          style={{ position: "absolute", top: 8, right: 8 }}
                          aria-label={inList ? "Retirer de la liste à voir" : "Ajouter à la liste à voir"}
                          onClick={() =>
                            inList ? toggleMovieWatchlist(m.id) : addMovieToWatchlist(m)
                          }
                        >
                          {inList ? "✓" : "+"}
                        </button>
                      )}
                    </div>
                  );
                })}
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
              <p className="muted">Aucun film ne correspond à votre recherche.</p>
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
                      <Poster item={{ ...m, status: movieStatus(inList, seen) }} mini />
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

      {/* 3. LIVRES RESULTS */}
      {type === "books" && (
        <>
          {!browsingBooks && bookRecs.length > 0 && (
            <>
              <h2 className="section-title">✨ Pour vous</h2>
              <div className="hscroll" style={{ marginBottom: 20 }}>
                {bookRecs.map(bookPosterRow)}
              </div>
            </>
          )}

          {!browsingBooks && (
            <>
              <h2 className="section-title">🔥 Tendances</h2>
              {bookTrending === null ? (
                <div className="hscroll" style={{ marginBottom: 20 }}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="skeleton" style={{ width: 128, aspectRatio: "2/3", borderRadius: 18, flexShrink: 0 }} />
                  ))}
                </div>
              ) : (
                <div className="hscroll" style={{ marginBottom: 20 }}>
                  {bookTrending.map(bookPosterRow)}
                </div>
              )}
            </>
          )}

          <h2 className="section-title">
            {browsingBooks ? "Résultats" : "Rechercher"}
            {filteredBookResults && <small>{filteredBookResults.length}</small>}
          </h2>

          {filteredBookResults === null ? (
            <div className="glass empty">
              <div className="big">📚</div>
              <p className="muted">
                Recherchez un titre, un auteur, un ISBN, ou choisissez une année —
                ou scannez un code-barres.
              </p>
            </div>
          ) : filteredBookResults.length === 0 ? (
            <div className="glass empty">
              <div className="big">🔍</div>
              <p className="muted">Aucun livre ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className="stack stack-wide">
              {filteredBookResults.map((b) => {
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
                      <Poster item={{ ...b, status: bookStatus(inList, read) }} mini />
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
