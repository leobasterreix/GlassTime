"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Poster from "@/components/Poster";
import { apiGet, followShow } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import type { Show } from "@/lib/types";

export default function DiscoverPage() {
  const mounted = useMounted();
  const followed = useTrack((st) => st.followed);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [results, setResults] = useState<Show[] | null>(null);

  useEffect(() => {
    apiGet<string[]>("/api/genres").then((g) => g && setGenres(g));
  }, []);

  const q = query.trim();
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      async () => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (genre) params.set("genre", genre);
        const data = await apiGet<Show[]>(`/api/shows?${params}`);
        if (!cancelled) setResults(data ?? []);
      },
      q ? 350 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, genre]);

  const searching = q.length > 0 || genre !== null;
  const trending = (results ?? []).slice(0, 10);

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
        {results && <small>{results.length}</small>}
      </h2>

      {results === null ? (
        <div className="glass empty">
          <div className="big">⏳</div>
          <p className="muted">Chargement…</p>
        </div>
      ) : results.length === 0 ? (
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
    </main>
  );
}
