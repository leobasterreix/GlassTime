"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Poster from "@/components/Poster";
import { useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";

type CollectionType = "shows" | "movies" | "books";
type Segment = "todo" | "done";

const TITLES: Record<CollectionType, string> = {
  shows: "📺 Mes séries",
  movies: "🎬 Mes films",
  books: "📚 Mes livres",
};

export default function CollectionPage() {
  const params = useParams<{ type: string }>();
  const router = useRouter();
  const type = (["shows", "movies", "books"].includes(params.type)
    ? params.type
    : "shows") as CollectionType;
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
  } = useTrack();
  useHydrateLibrary();
  const [segment, setSegment] = useState<Segment>("todo");

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">{TITLES[type]}</h1>
      </main>
    );
  }

  let items: { id: number | string; href: string; caption?: string; item: { title: string; poster?: string | null } }[] = [];
  let segments: { todo: string; done: string } | null = null;

  if (type === "shows") {
    items = followed
      .map((id) => showCache[id])
      .filter(Boolean)
      .map((s) => ({
        id: s.id,
        href: `/show/${s.id}`,
        item: s,
        caption:
          (showStatus[s.id] ?? "active") === "paused"
            ? "⏸️ En pause"
            : (showStatus[s.id] ?? "active") === "dropped"
              ? "🗑️ Abandonnée"
              : undefined,
      }));
  } else if (type === "movies") {
    segments = { todo: `À voir · ${movieWatchlist.length}`, done: `Vus · ${moviesWatched.length}` };
    const ids = segment === "todo" ? movieWatchlist : moviesWatched;
    items = ids
      .map((id) => movieCache[id])
      .filter(Boolean)
      .map((m) => ({ id: m.id, href: `/movie/${m.id}`, item: m }));
  } else {
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
        item: b,
        caption:
          segment === "done" && booksReadDates[b.id]
            ? `📅 ${booksReadDates[b.id]}`
            : undefined,
      }));
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
      <h1 className="page-title" style={{ fontSize: 26 }}>
        {TITLES[type]}
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
          <div className="big">🗂️</div>
          <p className="muted">Rien ici pour le moment.</p>
        </div>
      ) : (
        <div className="grid-posters">
          {items.map(({ id, href, item, caption }) => (
            <Link key={id} href={href} className="pressable">
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
