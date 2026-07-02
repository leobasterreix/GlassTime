"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Poster from "@/components/Poster";
import BarcodeScanner from "@/components/BarcodeScanner";
import { apiGet, useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import type { Book } from "@/lib/types";

type Tab = "watchlist" | "watched" | "discover";

function formatDateRead(dateStr?: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
  ];
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const monthName = months[Number(m) - 1] ?? "";
    const dayDisplay = Number(d) === 1 ? "1er" : Number(d);
    return `Lu le ${dayDisplay} ${monthName} ${y}`;
  }
  if (parts.length === 2) {
    const [y, m] = parts;
    const monthName = months[Number(m) - 1] ?? "";
    return `Lu en ${monthName} ${y}`;
  }
  return `Lu en ${dateStr}`;
}

export default function BooksPage() {
  const router = useRouter();
  const mounted = useMounted();
  const {
    booksWatchlist,
    booksRead,
    booksReadDates,
    bookCache,
    booksProgress,
    cacheBook,
    toggleBookWatchlist,
    toggleBookRead,
  } = useTrack();
  useHydrateLibrary();

  const [tab, setTab] = useState<Tab>("watchlist");
  const [query, setQuery] = useState("");
  const [discovered, setDiscovered] = useState<Book[] | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const q = query.trim();

  // Search effect
  useEffect(() => {
    if (tab !== "discover") return;
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        if (!q) {
          setDiscovered([]);
          return;
        }
        const data = await apiGet<Book[]>(`/api/books?q=${encodeURIComponent(q)}`);
        if (!cancelled) setDiscovered(data ?? []);
      },
      q ? 350 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, q]);

  // Load missing books cache (use ref to avoid infinite loop)
  const fetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!mounted) return;
    const allIds = [...new Set([...booksWatchlist, ...booksRead])];
    const missingIds = allIds.filter((id) => !bookCache[id] && !fetchedRef.current.has(id));
    if (missingIds.length === 0) return;

    missingIds.forEach((id) => fetchedRef.current.add(id));
    missingIds.forEach(async (id) => {
      try {
        const book = await apiGet<Book>(`/api/book/${id}`);
        if (book) cacheBook(book);
      } catch (err) {
        console.error("Error prefetching book cache:", err);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, booksWatchlist, booksRead]);

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Livres</h1>
        <p className="page-sub">Votre bibliothèque</p>
      </main>
    );
  }

  function addToWatchlist(b: Book) {
    cacheBook(b);
    toggleBookWatchlist(b.id);
  }

  function markRead(b: Book) {
    cacheBook(b);
    toggleBookRead(b.id);
  }

  function handleScanSuccess(book: Book) {
    cacheBook(book);
    setScannerOpen(false);
    // Redirect directly to the scanned book's detail page
    router.push(`/book/${book.id}`);
  }

  const lists: Record<Tab, Book[]> = {
    watchlist: booksWatchlist.map((id) => bookCache[id]).filter(Boolean),
    watched: booksRead
      .map((id) => bookCache[id])
      .filter(Boolean)
      .sort((a, b) => {
        const dA = booksReadDates[a.id] ?? "";
        const dB = booksReadDates[b.id] ?? "";
        return dB.localeCompare(dA); // Descending (plus récent en premier)
      }),
    discover: (discovered ?? []).filter(
      (b) => !booksWatchlist.includes(b.id) && !booksRead.includes(b.id)
    ),
  };
  const current = lists[tab];

  const emptyText: Record<Tab, string> = {
    watchlist: "Aucun livre dans votre liste d'envies. Parcourez l'onglet Découvrir ou scannez un livre !",
    watched: "Vous n'avez encore marqué aucun livre comme lu.",
    discover:
      tab === "discover" && discovered === null
        ? "Recherchez un livre par titre ou auteur..."
        : q
          ? "Aucun livre ne correspond à votre recherche."
          : "Recherchez un livre pour commencer à le suivre.",
  };

  return (
    <main className="page">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Livres</h1>
          <p className="page-sub">Votre bibliothèque</p>
        </div>
        <button
          className="btn btn-primary pressable row"
          style={{ padding: "10px 16px", borderRadius: 999, fontSize: 13.5, gap: 6, fontWeight: 700 }}
          onClick={() => setScannerOpen(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M7 12h10" />
          </svg>
          Scanner un livre
        </button>
      </div>

      <div className="glass segmented" style={{ marginBottom: 16, marginTop: 16 }}>
        <button
          className={tab === "watchlist" ? "active" : ""}
          onClick={() => setTab("watchlist")}
        >
          À lire ({booksWatchlist.length})
        </button>
        <button
          className={tab === "watched" ? "active" : ""}
          onClick={() => setTab("watched")}
        >
          Lus ({booksRead.length})
        </button>
        <button
          className={tab === "discover" ? "active" : ""}
          onClick={() => setTab("discover")}
        >
          Découvrir
        </button>
      </div>

      {tab === "discover" && (
        <div className="glass search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--text-3)" }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            placeholder="Rechercher un titre, un auteur, un ISBN..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {current.length === 0 ? (
        <div className="glass empty">
          <div className="big">📚</div>
          <p className="muted">{emptyText[tab]}</p>
        </div>
      ) : (
        <div className="stack stack-wide">
          {current.map((b) => {
            const inList = booksWatchlist.includes(b.id);
            const seen = booksRead.includes(b.id);
            
            const progress = booksProgress[b.id] ?? 0;
            const pagesTotal = b.pages ?? 0;
            const pct = pagesTotal > 0 ? Math.min(Math.round((progress / pagesTotal) * 100), 100) : 0;

            const meta = [
              b.author,
              b.year || null,
              b.pages ? `${b.pages} p.` : null,
              b.rating ? `★ ${b.rating.toFixed(1)}` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div key={b.id} className="glass card row" style={{ position: "relative" }}>
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

                  {seen && booksReadDates[b.id] && (
                    <div className="tiny" style={{ marginTop: 6, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 5 }}>
                      <span>📅</span>
                      <span>{formatDateRead(booksReadDates[b.id])}</span>
                    </div>
                  )}

                  {/* Visual Reading Progress Bar */}
                  {inList && pagesTotal > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div className="row" style={{ gap: 6, justifyContent: "space-between", marginBottom: 2 }}>
                        <span className="muted" style={{ fontSize: 11 }}>
                          Page {progress} / {pagesTotal}
                        </span>
                        <span className="tiny" style={{ fontSize: 10 }}>{pct}%</span>
                      </div>
                      <div className="progress" style={{ height: 4 }}>
                        <div style={{ width: `${pct}%`, background: "linear-gradient(90deg, #bf5af2, #0a84ff)" }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {!seen && (
                    <button
                      className={`check small${inList ? " checked" : ""}`}
                      aria-label="Liste à lire"
                      title="À lire"
                      onClick={() =>
                        inList ? toggleBookWatchlist(b.id) : addToWatchlist(b)
                      }
                    >
                      {inList ? "✓" : "+"}
                    </button>
                  )}
                  <button
                    className={`check${seen ? " checked" : ""}`}
                    aria-label="Marquer comme lu"
                    title="Lu"
                    onClick={() =>
                      seen ? toggleBookRead(b.id) : markRead(b)
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

      {scannerOpen && (
        <BarcodeScanner
          onClose={() => setScannerOpen(false)}
          onSuccess={handleScanSuccess}
        />
      )}
    </main>
  );
}
