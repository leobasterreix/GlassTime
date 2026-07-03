"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Poster from "@/components/Poster";
import { useHydrateLibrary, apiGet } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import { ACCENT_PRESETS } from "@/lib/accent";
import { toast } from "@/lib/toast";
import {
  disableNotifications,
  enableNotifications,
  notificationsEnabled,
  notificationsSupported,
} from "@/lib/notifications";
import { airedEpisodes, DAY, minutesHuman, watchedCount } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import type { Book, Movie, Show } from "@/lib/types";

const SYNC_KEYS = [
  "followed",
  "watched",
  "movieWatchlist",
  "moviesWatched",
  "moviesWatchedDates",
  "booksWatchlist",
  "booksRead",
  "booksReadDates",
  "showCache",
  "movieCache",
  "bookCache",
  "booksProgress",
  "showStatus",
  "watchedLog",
  "localReviews",
  "updatedAt",
] as const;

function cleanTitle(title: string): { name: string; year?: number } {
  const match = title.match(/^(.*?)\s*\((\d{4})\)$/);
  if (match) {
    return { name: match[1].trim(), year: parseInt(match[2], 10) };
  }
  return { name: title.trim() };
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(val => val.replace(/^["']|["']$/g, "").trim());
}

function formatDateRead(dateStr?: string): string {
  if (!dateStr) return "";
  const months = [
    "janv.", "févr.", "mars", "avril", "mai", "juin",
    "juil.", "août", "sept.", "oct.", "nov.", "déc.",
  ];
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${Number(d) === 1 ? "1er" : Number(d)} ${months[Number(m) - 1] ?? ""} ${y}`;
  }
  if (parts.length === 2) {
    const [y, m] = parts;
    return `${months[Number(m) - 1] ?? ""} ${y}`;
  }
  return dateStr;
}

export default function ProfilePage() {
  const mounted = useMounted();
  const {
    followed,
    watched,
    movieWatchlist,
    moviesWatched,
    moviesWatchedDates,
    booksWatchlist,
    booksRead,
    booksReadDates,
    showCache,
    movieCache,
    bookCache,
    watchedLog,
    importState,
    clearAll,
    theme,
    toggleTheme,
    accent,
    setAccent,
  } = useTrack();
  useHydrateLibrary();

  // Accent actif ne correspondant à aucune des pastilles prédéfinies
  const isCustomAccent =
    !!accent && !ACCENT_PRESETS.some((p) => p.value === accent);

  const [userInfo, setUserInfo] = useState<{ name: string; email: string; avatar?: string } | null>(null);
  const [syncOn, setSyncOn] = useState<boolean | null>(null);
  const [notifsOn, setNotifsOn] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    setNotifsOn(notificationsEnabled());
  }, []);

  function exportData() {
    const st = useTrack.getState() as unknown as Record<string, unknown>;
    const data = Object.fromEntries(SYNC_KEYS.map((k) => [k, st[k]]));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glasstime-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Sauvegarde téléchargée", "💾");
  }

  function importData(file: File) {
    file.text().then((text) => {
      try {
        const data = JSON.parse(text);
        if (!data || typeof data !== "object" || !Array.isArray(data.followed))
          throw new Error("format");
        importState(data);
        toast("Données importées !", "📥");
      } catch {
        toast("Fichier invalide — export GlassTime attendu", "⚠️");
      }
    });
  }

  async function handleCSVImport(file: File) {
    setImporting(true);
    setImportStatus("Lecture du fichier...");

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error("Fichier CSV vide ou invalide");
      }

      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = parseCSVLine(lines[0], delimiter);
      
      const colIndex = (name: string) => headers.indexOf(name);
      const idxType = colIndex("type");
      const idxMediaType = colIndex("media_type");
      const idxTmdbId = colIndex("tmdb_id");
      const idxTitle = colIndex("title");
      const idxSeason = colIndex("season");
      const idxEpisode = colIndex("episode");
      const idxWatchedAt = colIndex("watched_at");

      if (idxType === -1 || idxMediaType === -1 || idxTitle === -1) {
        throw new Error("Colonnes requises manquantes dans le CSV (type, media_type, title)");
      }

      // Group watch events
      const tvShowsToImport = new Map<string, {
        tmdbId?: string;
        title: string;
        episodes: { s: number; e: number; date?: string }[];
      }>();

      const moviesToImport = new Map<string, {
        tmdbId?: string;
        title: string;
        date?: string;
      }>();

      for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i], delimiter);
        if (parts.length < headers.length) continue;

        const rowType = parts[idxType];
        if (rowType !== "watch") continue; // only import watched items

        const mediaType = parts[idxMediaType];
        const tmdbId = idxTmdbId !== -1 ? parts[idxTmdbId] : "";
        const title = parts[idxTitle];
        const seasonVal = idxSeason !== -1 ? parts[idxSeason] : "";
        const episodeVal = idxEpisode !== -1 ? parts[idxEpisode] : "";
        const watchedAt = idxWatchedAt !== -1 ? parts[idxWatchedAt] : "";

        if (mediaType === "episode") {
          const s = parseInt(seasonVal, 10);
          const e = parseInt(episodeVal, 10);
          if (isNaN(s) || isNaN(e)) continue;

          const key = tmdbId ? `id:${tmdbId}` : `title:${title}`;
          let show = tvShowsToImport.get(key);
          if (!show) {
            show = { tmdbId: tmdbId || undefined, title, episodes: [] };
            tvShowsToImport.set(key, show);
          }
          show.episodes.push({ s, e, date: watchedAt });
        } else if (mediaType === "movie") {
          const key = tmdbId ? `id:${tmdbId}` : `title:${title}`;
          if (!moviesToImport.has(key)) {
            moviesToImport.set(key, { tmdbId: tmdbId || undefined, title, date: watchedAt });
          }
        }
      }

      const totalItems = tvShowsToImport.size + moviesToImport.size;
      if (totalItems === 0) {
        throw new Error("Aucun historique de visionnage trouvé dans le fichier.");
      }

      let importedShowsCount = 0;
      let importedMoviesCount = 0;
      let currentStep = 0;

      // Temporary local copies of states to batch update at the end
      const newFollowed = new Set([...useTrack.getState().followed]);
      const newWatched = { ...useTrack.getState().watched };
      const newMoviesWatched = new Set([...useTrack.getState().moviesWatched]);
      const newShowCache = { ...useTrack.getState().showCache };
      const newMovieCache = { ...useTrack.getState().movieCache };

      // Process TV Shows
      for (const [, item] of tvShowsToImport.entries()) {
        currentStep++;
        setImportStatus(`Importation des séries (${currentStep}/${totalItems}) : ${item.title}...`);

        let tmdbIdNum: number | null = null;
        if (item.tmdbId) {
          tmdbIdNum = parseInt(item.tmdbId, 10);
        }

        // If no TMDB ID, look it up by title
        if (!tmdbIdNum || isNaN(tmdbIdNum)) {
          const { name, year } = cleanTitle(item.title);
          try {
            const results = await apiGet<Show[]>(`/api/shows?q=${encodeURIComponent(name)}`);
            if (results && results.length > 0) {
              let bestMatch = results[0];
              if (year) {
                const matchedYear = results.find(s => s.year === year);
                if (matchedYear) bestMatch = matchedYear;
              }
              tmdbIdNum = bestMatch.id;
            }
          } catch (err) {
            console.error(`Error searching show ${item.title}:`, err);
          }
        }

        if (tmdbIdNum && !isNaN(tmdbIdNum)) {
          try {
            // Fetch complete show details to get seasons structure
            const showDetails = await apiGet<Show>(`/api/show/${tmdbIdNum}`);
            if (showDetails) {
              newShowCache[tmdbIdNum] = showDetails;
              newFollowed.add(tmdbIdNum);
              
              if (!newWatched[tmdbIdNum]) {
                newWatched[tmdbIdNum] = {};
              }

              for (const ep of item.episodes) {
                newWatched[tmdbIdNum][`${ep.s}:${ep.e}`] = true;
              }
              importedShowsCount++;
            }
          } catch (err) {
            console.error(`Error loading show ${tmdbIdNum}:`, err);
          }
        }
      }

      // Process Movies
      for (const [, item] of moviesToImport.entries()) {
        currentStep++;
        setImportStatus(`Importation des films (${currentStep}/${totalItems}) : ${item.title}...`);

        let tmdbIdNum: number | null = null;
        if (item.tmdbId) {
          tmdbIdNum = parseInt(item.tmdbId, 10);
        }

        if (!tmdbIdNum || isNaN(tmdbIdNum)) {
          const { name } = cleanTitle(item.title);
          try {
            const results = await apiGet<Movie[]>(`/api/movies?q=${encodeURIComponent(name)}`);
            if (results && results.length > 0) {
              tmdbIdNum = results[0].id;
            }
          } catch (err) {
            console.error(`Error searching movie ${item.title}:`, err);
          }
        }

        if (tmdbIdNum && !isNaN(tmdbIdNum)) {
          try {
            const movieDetails = await apiGet<Movie>(`/api/movie/${tmdbIdNum}`);
            if (movieDetails) {
              newMovieCache[tmdbIdNum] = movieDetails;
              newMoviesWatched.add(tmdbIdNum);
              importedMoviesCount++;
            }
          } catch (err) {
            console.error(`Error loading movie ${tmdbIdNum}:`, err);
          }
        }
      }

      // Batch update the Zustand store state
      useTrack.setState({
        followed: Array.from(newFollowed),
        watched: newWatched,
        moviesWatched: Array.from(newMoviesWatched),
        showCache: newShowCache,
        movieCache: newMovieCache,
        updatedAt: Date.now(),
      });

      toast(`Importation réussie : ${importedShowsCount} séries et ${importedMoviesCount} films importés !`, "🎉");
    } catch (err: any) {
      toast(err.message || "Erreur lors de l'importation du CSV", "⚠️");
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata;
        setUserInfo({
          name: meta?.full_name ?? "Mon espace",
          email: session.user.email ?? "",
          avatar: meta?.avatar_url ?? meta?.picture ?? undefined,
        });
        setSyncOn(true);
      } else {
        setSyncOn(false);
      }
    });
  }, []);

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Profil</h1>
        <p className="page-sub">Vos statistiques</p>
      </main>
    );
  }

  // Épisodes vus : compte direct depuis le journal de visionnage
  const episodesSeen = Object.values(watched).reduce(
    (acc, map) => acc + Object.keys(map).length,
    0
  );
  const showMinutes = Object.entries(watched).reduce(
    (acc, [showId, map]) =>
      acc + Object.keys(map).length * (showCache[Number(showId)]?.runtime ?? 45),
    0
  );
  const completed = followed.filter((id) => {
    const show = showCache[id];
    if (!show) return false;
    const aired = airedEpisodes(show).length;
    return aired > 0 && watchedCount(show, watched[id]) >= aired;
  }).length;
  const movieMinutes = moviesWatched.reduce(
    (acc, id) => acc + (movieCache[id]?.runtime ?? 115),
    0
  );

  // Genres favoris (pondérés par épisodes vus + films vus)
  const genreCount = new Map<string, number>();
  for (const [showId, map] of Object.entries(watched)) {
    const show = showCache[Number(showId)];
    const n = Object.keys(map).length;
    if (show && n > 0)
      for (const g of show.genres)
        genreCount.set(g, (genreCount.get(g) ?? 0) + n);
  }
  for (const id of moviesWatched) {
    const movie = movieCache[id];
    if (movie)
      for (const g of movie.genres)
        genreCount.set(g, (genreCount.get(g) ?? 0) + 3);
  }
  const topGenres = Array.from(genreCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxGenre = topGenres[0]?.[1] ?? 1;

  const badges = [
    { emoji: "🎬", label: "Premier épisode", done: episodesSeen >= 1 },
    { emoji: "📚", label: "5 séries suivies", done: followed.length >= 5 },
    { emoji: "🏃", label: "Marathonien · 100 épisodes", done: episodesSeen >= 100 },
    { emoji: "🏆", label: "Série terminée", done: completed >= 1 },
    { emoji: "🍿", label: "Cinéphile · 10 films", done: moviesWatched.length >= 10 },
    { emoji: "⏰", label: "24 h de visionnage", done: showMinutes + movieMinutes >= 1440 },
  ];

  // Collections (fiches disponibles dans le cache local)
  const myShows = followed.map((id) => showCache[id]).filter(Boolean);
  const moviesToWatch = movieWatchlist.map((id) => movieCache[id]).filter(Boolean);
  const moviesSeen = moviesWatched.map((id) => movieCache[id]).filter(Boolean);
  const booksToRead = booksWatchlist.map((id) => bookCache[id]).filter(Boolean);
  const booksDone = booksRead
    .map((id) => bookCache[id])
    .filter(Boolean)
    .sort((a, b) =>
      (booksReadDates[b.id] ?? "").localeCompare(booksReadDates[a.id] ?? "")
    );

  const pagesRead = booksRead.reduce(
    (acc, id) => acc + (bookCache[id]?.pages ?? 0),
    0
  );

  const stats = [
    { value: String(episodesSeen), label: "épisodes vus" },
    { value: minutesHuman(showMinutes) || "0 min", label: "devant les séries" },
    { value: String(followed.length), label: "séries suivies" },
    { value: String(completed), label: "séries terminées" },
    { value: String(moviesWatched.length), label: "films vus" },
    { value: minutesHuman(movieMinutes) || "0 min", label: "devant les films" },
    { value: String(booksRead.length), label: "livres lus" },
    { value: String(pagesRead), label: "pages lues" },
  ];

  // Records
  const mostWatched = Object.entries(watched)
    .map(([showId, map]) => ({
      show: showCache[Number(showId)],
      n: Object.keys(map).length,
    }))
    .filter((x) => x.show && x.n > 0)
    .sort((a, b) => b.n - a.n)[0];
  const bestDay = Object.entries(watchedLog).sort((a, b) => b[1] - a[1])[0];

  // Activité des 8 dernières semaines (journal de marquage)
  const weeks: { label: string; n: number }[] = [];
  const nowT = Date.now();
  for (let w = 7; w >= 0; w--) {
    const start = nowT - (w + 1) * 7 * DAY;
    const end = nowT - w * 7 * DAY;
    let n = 0;
    for (const [day, count] of Object.entries(watchedLog)) {
      const t = new Date(day).getTime();
      if (t > start && t <= end) n += count;
    }
    weeks.push({
      label: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(end)),
      n,
    });
  }
  const maxWeek = Math.max(1, ...weeks.map((w) => w.n));
  const hasActivity = weeks.some((w) => w.n > 0);

  return (
    <main className="page">
      <h1 className="page-title">Profil</h1>
      <p className="page-sub">Vos statistiques</p>

      <div
        className="glass card row"
        style={{ marginBottom: 20, gap: 16, padding: 20 }}
      >
        {userInfo?.avatar ? (
          <img
            src={userInfo.avatar}
            alt="Avatar"
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              border: "1px solid var(--glass-border)",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              background: "var(--accent-wash)",
              border: "1px solid var(--accent)",
            }}
          >
            🍿
          </div>
        )}
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{userInfo?.name ?? "Mon espace"}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {userInfo?.email ? `${userInfo.email} · ` : ""}
            {minutesHuman(showMinutes + movieMinutes) || "0 min"} au total
          </div>
        </div>
      </div>

      <div className="grid-stats">
        {stats.map((s) => (
          <div key={s.label} className="glass card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 21, fontWeight: 800 }}>{s.value}</div>
            <div className="tiny" style={{ marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Activité récente */}
      {hasActivity && (
        <>
          <h2 className="section-title">Activité · 8 semaines</h2>
          <div className="glass card">
            <div className="row" style={{ alignItems: "flex-end", gap: 8, height: 90 }}>
              {weeks.map((w, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div
                    style={{
                      height: Math.max(4, Math.round((w.n / maxWeek) * 62)),
                      borderRadius: 6,
                      background:
                        w.n > 0
                          ? "linear-gradient(180deg, var(--accent), var(--accent-2))"
                          : "var(--track)",
                    }}
                    title={`${w.n} marquage${w.n > 1 ? "s" : ""}`}
                  />
                  <div className="tiny" style={{ marginTop: 5, fontSize: 9.5 }}>
                    {w.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Records */}
      {(mostWatched || bestDay) && (
        <>
          <h2 className="section-title">Records</h2>
          <div className="grid-stats badges">
            {mostWatched && (
              <div className="glass card row" style={{ gap: 10 }}>
                <span style={{ fontSize: 24 }}>👑</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {mostWatched.show.title}
                  </div>
                  <div className="tiny">
                    série la plus vue · {mostWatched.n} épisodes
                  </div>
                </div>
              </div>
            )}
            {bestDay && (
              <div className="glass card row" style={{ gap: 10 }}>
                <span style={{ fontSize: 24 }}>⚡</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {bestDay[1]} marquages en un jour
                  </div>
                  <div className="tiny">
                    le{" "}
                    {new Date(bestDay[0]).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Mes séries */}
      {myShows.length > 0 && (
        <>
          <h2 className="section-title">
            📺 Mes séries{" "}
            <Link href="/collection/shows" className="tiny" style={{ fontWeight: 700 }}>
              Voir tout · {myShows.length} →
            </Link>
          </h2>
          <div className="hscroll">
            {myShows.slice(0, 12).map((s) => (
              <Link key={s.id} href={`/show/${s.id}`} className="pressable">
                <Poster item={s} />
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Mes films */}
      {(moviesToWatch.length > 0 || moviesSeen.length > 0) && (
        <>
          <h2 className="section-title">
            🎬 Mes films{" "}
            <Link href="/collection/movies" className="tiny" style={{ fontWeight: 700 }}>
              Voir tout · {moviesToWatch.length + moviesSeen.length} →
            </Link>
          </h2>
          {moviesToWatch.length > 0 && (
            <>
              <h3 className="muted" style={{ fontSize: 14, fontWeight: 700, margin: "4px 0 10px" }}>
                À voir · {moviesToWatch.length}
              </h3>
              <div className="hscroll">
                {moviesToWatch.slice(0, 12).map((m) => (
                  <Link key={m.id} href={`/movie/${m.id}`} className="pressable">
                    <Poster item={m} />
                  </Link>
                ))}
              </div>
            </>
          )}
          {moviesSeen.length > 0 && (
            <>
              <h3 className="muted" style={{ fontSize: 14, fontWeight: 700, margin: "4px 0 10px" }}>
                Vus · {moviesSeen.length}
              </h3>
              <div className="hscroll">
                {moviesSeen.slice(0, 12).map((m) => (
                  <Link key={m.id} href={`/movie/${m.id}`} className="pressable">
                    <Poster item={m} />
                    {moviesWatchedDates[m.id] && (
                      <div className="tiny" style={{ marginTop: 5, textAlign: "center" }}>
                        📅 {formatDateRead(moviesWatchedDates[m.id])}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Mes livres */}
      {(booksToRead.length > 0 || booksDone.length > 0) && (
        <>
          <h2 className="section-title">
            📚 Mes livres{" "}
            <Link href="/collection/books" className="tiny" style={{ fontWeight: 700 }}>
              Voir tout · {booksToRead.length + booksDone.length} →
            </Link>
          </h2>
          {booksToRead.length > 0 && (
            <>
              <h3 className="muted" style={{ fontSize: 14, fontWeight: 700, margin: "4px 0 10px" }}>
                À lire · {booksToRead.length}
              </h3>
              <div className="hscroll">
                {booksToRead.slice(0, 12).map((b) => (
                  <Link key={b.id} href={`/book/${b.id}`} className="pressable">
                    <Poster item={b} />
                  </Link>
                ))}
              </div>
            </>
          )}
          {booksDone.length > 0 && (
            <>
              <h3 className="muted" style={{ fontSize: 14, fontWeight: 700, margin: "4px 0 10px" }}>
                Lus · {booksDone.length}
              </h3>
              <div className="hscroll">
                {booksDone.slice(0, 12).map((b) => (
                  <Link key={b.id} href={`/book/${b.id}`} className="pressable">
                    <Poster item={b} />
                    {booksReadDates[b.id] && (
                      <div className="tiny" style={{ marginTop: 5, textAlign: "center" }}>
                        📅 {formatDateRead(booksReadDates[b.id])}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {topGenres.length > 0 && (
        <>
          <h2 className="section-title">Genres favoris</h2>
          <div className="glass card stack" style={{ gap: 14 }}>
            {topGenres.map(([g, n]) => (
              <div key={g}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{g}</span>
                </div>
                <div className="progress">
                  <div style={{ width: `${Math.round((n / maxGenre) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Badges</h2>
      <div className="grid-stats badges">
        {badges.map((b) => (
          <div
            key={b.label}
            className="glass card row"
            style={{ opacity: b.done ? 1 : 0.45, gap: 10 }}
          >
            <span style={{ fontSize: 24 }}>{b.emoji}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{b.label}</div>
              <div className="tiny">{b.done ? "Débloqué" : "À débloquer"}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-title">Préférences</h2>
      <div className="stack" style={{ marginBottom: 20 }}>
        <button
          className="glass card pressable"
          style={{
            width: "100%",
            textAlign: "center",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
          onClick={toggleTheme}
        >
          {theme === "system"
            ? "⚙️ Thème : Système"
            : theme === "light"
              ? "☀️ Thème : Clair"
              : "🌙 Thème : Sombre"}
        </button>

        {/* Couleur d'accent : 4 teintes + sélecteur libre */}
        <div className="glass card stack" style={{ gap: 14 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Couleur d'accent</span>
            <div className="row" style={{ gap: 10 }}>
              {ACCENT_PRESETS.map((p) => {
                const active = accent === p.value;
                return (
                  <button
                    key={p.name}
                    className="accent-swatch pressable"
                    aria-label={p.name}
                    title={p.name}
                    onClick={() => {
                      setAccent(p.value);
                      toast(`Accent : ${p.name}`, "🎨");
                    }}
                    style={{
                      background: p.swatch,
                      boxShadow: active
                        ? `0 0 0 2px var(--surface), 0 0 0 4px ${p.swatch}`
                        : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Couleur personnalisée</span>
            <label
              className="row"
              style={{ gap: 10, cursor: "pointer" }}
              title="Choisir n'importe quelle couleur"
            >
              <span className="tiny" style={{ textTransform: "uppercase" }}>
                {isCustomAccent ? accent : "Choisir"}
              </span>
              <input
                type="color"
                className="accent-picker"
                value={accent ?? "#d9503a"}
                onChange={(e) => setAccent(e.target.value)}
                style={
                  isCustomAccent
                    ? { boxShadow: `0 0 0 2px var(--surface), 0 0 0 4px ${accent}` }
                    : undefined
                }
              />
            </label>
          </div>
        </div>
        {notificationsSupported() && (
          <button
            className="glass card pressable"
            style={{ width: "100%", textAlign: "center", fontWeight: 700 }}
            onClick={async () => {
              if (notifsOn) {
                disableNotifications();
                setNotifsOn(false);
                toast("Notifications désactivées", "🔕");
              } else {
                const ok = await enableNotifications();
                setNotifsOn(ok);
                toast(
                  ok
                    ? "Vous serez notifié des sorties du jour"
                    : "Autorisation refusée par le navigateur",
                  ok ? "🔔" : "⚠️"
                );
              }
            }}
          >
            {notifsOn
              ? "🔔 Notifications de sortie : activées"
              : "🔕 Notifications de sortie : désactivées"}
          </button>
        )}
      </div>

      <h2 className="section-title">Données</h2>
      <div className="stack">
        <div className="glass card row" style={{ gap: 10 }}>
          <span style={{ fontSize: 20 }}>☁️</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>
              Synchronisation multi-appareils
            </div>
            <div className="tiny">
              {syncOn === null
                ? "Vérification…"
                : syncOn
                  ? "Active — vos données sont synchronisées via Supabase"
                  : "Inactive — données locales uniquement"}
            </div>
          </div>
        </div>
        <div className="row">
          <button
            className="glass card pressable"
            style={{ flex: 1, textAlign: "center", fontWeight: 700 }}
            onClick={exportData}
          >
            💾 Exporter
          </button>
          <button
            className="glass card pressable"
            style={{ flex: 1, textAlign: "center", fontWeight: 700 }}
            onClick={() => importInputRef.current?.click()}
          >
            📥 Importer
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = "";
            }}
          />
        </div>
        <button
          className="glass card pressable"
          style={{ width: "100%", textAlign: "center", fontWeight: 700 }}
          onClick={() => csvInputRef.current?.click()}
        >
          📊 Importer un CSV TV Time
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCSVImport(f);
            e.target.value = "";
          }}
        />
        <button
          className="glass card pressable"
          style={{ width: "100%", textAlign: "center", fontWeight: 700 }}
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          🔒 Se déconnecter
        </button>
        <button
          className="glass card pressable"
          style={{ width: "100%", textAlign: "center", color: "var(--danger)", fontWeight: 700 }}
          onClick={() => {
            if (confirm("Effacer toutes vos données de suivi ? Cette action est irréversible.")) {
              clearAll();
            }
          }}
        >
          Effacer mes données
        </button>
      </div>

      {importing && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(12px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 24,
          textAlign: "center"
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "#fff" }}>Importation de vos données TV Time</h2>
          <p className="muted" style={{ fontSize: 14, maxWidth: 400, lineHeight: 1.5 }}>{importStatus}</p>
        </div>
      )}
    </main>
  );
}
