"use client";

import Link from "next/link";
import { useState } from "react";
import Poster from "@/components/Poster";
import { GENRES, SHOWS } from "@/lib/data";
import { useMounted, useTrack } from "@/lib/store";

export default function DiscoverPage() {
  const mounted = useMounted();
  const { followed, toggleFollow } = useTrack();
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const results = SHOWS.filter(
    (s) =>
      (!q || s.title.toLowerCase().includes(q)) &&
      (!genre || s.genres.includes(genre))
  );
  const trending = SHOWS.filter((s) => s.trending);
  const searching = q.length > 0 || genre !== null;

  return (
    <main className="page">
      <h1 className="page-title">Découvrir</h1>
      <p className="page-sub">Trouvez votre prochaine série</p>

      <div className="glass search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--text-3)" }}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          placeholder="Rechercher une série…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="hscroll" style={{ paddingBottom: 8 }}>
        {GENRES.map((g) => (
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

      {!searching && (
        <>
          <h2 className="section-title">🔥 Tendances</h2>
          <div className="hscroll">
            {trending.map((s) => (
              <Link key={s.id} href={`/show/${s.id}`} className="pressable">
                <Poster emoji={s.emoji} colors={s.colors} title={s.title} />
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">
        {searching ? "Résultats" : "Toutes les séries"}
        <small>{results.length}</small>
      </h2>

      {results.length === 0 ? (
        <div className="glass empty">
          <div className="big">🔍</div>
          <p className="muted">Aucune série ne correspond à votre recherche.</p>
        </div>
      ) : (
        <div className="grid-posters">
          {results.map((s) => {
            const isFollowed = mounted && followed.includes(s.id);
            return (
              <div key={s.id} style={{ position: "relative" }}>
                <Link href={`/show/${s.id}`} className="pressable" style={{ display: "block" }}>
                  <Poster emoji={s.emoji} colors={s.colors} title={s.title} />
                </Link>
                <button
                  className={`check small${isFollowed ? " checked" : ""}`}
                  style={{ position: "absolute", top: 8, right: 8 }}
                  aria-label={isFollowed ? "Ne plus suivre" : "Suivre"}
                  onClick={() => toggleFollow(s.id)}
                >
                  {isFollowed ? "✓" : "+"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
