"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Calendar, Clapperboard, FolderOpen, Heart, Library, Tv, type LucideIcon } from "lucide-react";
import Poster from "@/components/Poster";
import { useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import {
  bookStatus,
  effectiveShowStatus,
  movieStatus,
  type DisplayStatus,
} from "@/lib/utils";

type CollectionType = "shows" | "movies" | "books" | "favorites";
type Segment = "todo" | "done";

const TITLES: Record<CollectionType, { label: string; Icon: LucideIcon }> = {
  shows: { label: "Mes séries", Icon: Tv },
  movies: { label: "Mes films", Icon: Clapperboard },
  books: { label: "Mes livres", Icon: Library },
  favorites: { label: "Mes favoris", Icon: Heart },
};

export default function CollectionPage() {
  const params = useParams<{ type: string }>();
  const router = useRouter();
  const type = (["shows", "movies", "books", "favorites"].includes(params.type)
    ? params.type
    : "shows") as CollectionType;
  const { label: titleLabel, Icon: TitleIcon } = TITLES[type];
  const mounted = useMounted();
  const {
    followed,
    showCache,
    showStatus,
    movieWatchlist,
    moviesWatched,
    movieCache,
    booksWatchlist,
    booksRead,
    booksReadDates,
    bookCache,
    favoriteShows,
    favoriteMovies,
    favoriteBooks,
  } = useTrack();
  useHydrateLibrary();
  const [segment, setSegment] = useState<Segment>("todo");

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <TitleIcon size={22} /> {titleLabel}
        </h1>
      </main>
    );
  }

  let items: {
    id: number | string;
    href: string;
    caption?: React.ReactNode;
    item: { title: string; poster?: string | null; status?: DisplayStatus };
  }[] = [];
  let segments: { todo: string; done: string } | null = null;

  if (type === "shows") {
    items = followed
      .map((id) => showCache[id])
      .filter(Boolean)
      .map((s) => ({
        id: s.id,
        href: `/show/${s.id}`,
        item: { ...s, status: effectiveShowStatus(s, showStatus[s.id]) },
        // « Abandonnée » est déjà couverte par le bandeau violet sur l'affiche ;
        // seule « en pause » (non représentée par le bandeau) garde sa légende.
        caption: (showStatus[s.id] ?? "active") === "paused" ? "⏸️ En pause" : undefined,
      }));
  } else if (type === "movies") {
    segments = { todo: `À voir · ${movieWatchlist.length}`, done: `Vus · ${moviesWatched.length}` };
    const ids = segment === "todo" ? movieWatchlist : moviesWatched;
    items = ids
      .map((id) => movieCache[id])
      .filter(Boolean)
      .map((m) => ({
        id: m.id,
        href: `/movie/${m.id}`,
        item: { ...m, status: movieStatus(segment === "todo", segment === "done") },
      }));
  } else if (type === "books") {
    segments = { todo: `À lire · ${booksWatchlist.length}`, done: `Lus · ${booksRead.length}` };
    const ids =
      segment === "todo"
        ? booksWatchlist
        : [...booksRead].sort((a, b) =>
            (booksReadDates[b] ?? "").localeCompare(booksReadDates[a] ?? "")
          );
    items = ids
      .map((id) => bookCache[id])
      .filter(Boolean)
      .map((b) => ({
        id: b.id,
        href: `/book/${b.id}`,
        item: { ...b, status: bookStatus(segment === "todo", segment === "done") },
        caption:
          segment === "done" && booksReadDates[b.id] ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Calendar size={11} /> {booksReadDates[b.id]}
            </span>
          ) : undefined,
      }));
  } else {
    // Favoris : mélange séries, films et livres, chacun avec sa propre route
    items = [
      ...favoriteShows
        .map((id) => showCache[id])
        .filter(Boolean)
        .map((s) => ({
          id: `show-${s.id}`,
          href: `/show/${s.id}`,
          item: { ...s, status: effectiveShowStatus(s, showStatus[s.id]) },
          caption: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Tv size={11} /> Série
            </span>
          ),
        })),
      ...favoriteMovies
        .map((id) => movieCache[id])
        .filter(Boolean)
        .map((m) => ({
          id: `movie-${m.id}`,
          href: `/movie/${m.id}`,
          item: {
            ...m,
            status: movieStatus(movieWatchlist.includes(m.id), moviesWatched.includes(m.id)),
          },
          caption: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Clapperboard size={11} /> Film
            </span>
          ),
        })),
      ...favoriteBooks
        .map((id) => bookCache[id])
        .filter(Boolean)
        .map((b) => ({
          id: `book-${b.id}`,
          href: `/book/${b.id}`,
          item: {
            ...b,
            status: bookStatus(booksWatchlist.includes(b.id), booksRead.includes(b.id)),
          },
          caption: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Library size={11} /> Livre
            </span>
          ),
        })),
    ];
  }

  return (
    <main className="page">
      <button
        className="chip pressable"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/agenda"))}
        style={{ marginBottom: 16 }}
      >
        ← Retour
      </button>
      <h1 className="page-title" style={{ fontSize: 26, display: "inline-flex", alignItems: "center", gap: 8 }}>
        <TitleIcon size={22} /> {titleLabel}
      </h1>
      <p className="page-sub">{items.length} élément{items.length > 1 ? "s" : ""}</p>

      {segments && (
        <div className="glass segmented" style={{ marginBottom: 18 }}>
          <button
            className={segment === "todo" ? "active" : ""}
            onClick={() => setSegment("todo")}
          >
            {segments.todo}
          </button>
          <button
            className={segment === "done" ? "active" : ""}
            onClick={() => setSegment("done")}
          >
            {segments.done}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="glass empty">
          {type === "favorites" ? (
            <Heart className="big" size={40} strokeWidth={1.5} />
          ) : (
            <FolderOpen className="big" size={40} strokeWidth={1.5} />
          )}
          <p className="muted">
            {type === "favorites"
              ? "Aucun favori pour le moment. Le cœur sur une fiche l'ajoute ici."
              : "Rien ici pour le moment."}
          </p>
        </div>
      ) : (
        <div className="grid-posters">
          {items.map(({ id, href, item, caption }, i) => (
            <Link
              key={id}
              href={href}
              className="pressable stagger-item-in"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <Poster item={item} />
              {caption && (
                <div className="tiny" style={{ marginTop: 5, textAlign: "center" }}>
                  {caption}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
