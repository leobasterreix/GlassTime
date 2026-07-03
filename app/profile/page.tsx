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
import { airedEpisodes, DAY, effectiveShowStatus, minutesHuman, watchedCount } from "@/lib/utils";
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
  "accent",
  "favoriteShows",
  "favoriteMovies",
  "favoriteBooks",
  "updatedAt",
] as const;

const EMOJI_AVATARS = [
  "🍿", "🎬", "📺", "👾", "🦊", "🦁", "🐼", "🚀",
  "🎭", "🎨", "🤠", "🐶", "🐱", "🦄", "🍀", "💎"
];

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
    showStatus,
    watchedLog,
    importState,
    clearAll,
    theme,
    toggleTheme,
    accent,
    setAccent,
    favoriteShows,
    favoriteMovies,
    favoriteBooks,
  } = useTrack();
  useHydrateLibrary();

  // Accent actif ne correspondant à aucune des pastilles prédéfinies
  const isCustomAccent =
    !!accent && !ACCENT_PRESETS.some((p) => p.value === accent);

    const [userInfo, setUserInfo] = useState<{ id: string; name: string; email: string; avatar?: string } | null>(null);
  const [syncOn, setSyncOn] = useState<boolean | null>(null);
  const [notifsOn, setNotifsOn] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  // États pour l'édition du profil
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  function openEditModal() {
    setEditName(userInfo?.name ?? "");
    setEditAvatarUrl(userInfo?.avatar ?? "");
    setCurrentPassword("");
    setEditPassword("");
    setEditConfirmPassword("");
    setShowCurrentPassword(false);
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);
    setEditError(null);
    setEditSuccess(null);
    setIsEditing(true);
  }

  function closeEditModal() {
    setIsEditing(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (editLoading) return;
    setEditError(null);
    setEditSuccess(null);

    if (!editName.trim()) {
      setEditError("Le nom ne peut pas être vide.");
      return;
    }
    if (editPassword) {
      if (!currentPassword) {
        setEditError("Veuillez saisir votre mot de passe actuel.");
        return;
      }
      if (editPassword.length < 6) {
        setEditError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
        return;
      }
      if (editPassword !== editConfirmPassword) {
        setEditError("Les nouveaux mots de passe ne correspondent pas.");
        return;
      }
    }

    setEditLoading(true);
    try {
      // 1. Si changement de mot de passe, vérifier le mot de passe actuel
      if (editPassword) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: userInfo?.email || "",
          password: currentPassword,
        });
        if (verifyError) {
          setEditError("Le mot de passe actuel est incorrect.");
          setEditLoading(false);
          return;
        }
      }

      // 2. Mettre à jour les métadonnées (nom + avatar)
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: editName.trim(),
          avatar_url: editAvatarUrl.trim() || null,
        }
      });
      if (error) throw error;

      // 3. Mettre à jour le mot de passe
      if (editPassword) {
        const { error: passError } = await supabase.auth.updateUser({
          password: editPassword,
        });
        if (passError) throw passError;
      }

      // 4. Mettre à jour l'affichage local
      setUserInfo({
        id: userInfo?.id ?? "",
        name: editName.trim(),
        email: userInfo?.email ?? "",
        avatar: editAvatarUrl.trim() || undefined,
      });

      setEditSuccess("Profil mis à jour avec succès !");
      setTimeout(() => {
        setIsEditing(false);
        setEditSuccess(null);
        setCurrentPassword("");
        setEditPassword("");
        setEditConfirmPassword("");
      }, 1200);
    } catch (err: any) {
      setEditError(err.message || "Une erreur est survenue lors de la mise à jour.");
    } finally {
      setEditLoading(false);
    }
  }

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

  const [activeTab, setActiveTab] = useState<"stats" | "community">("stats");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [myFollows, setMyFollows] = useState<any[]>([]);
  const [myFollowers, setMyFollowers] = useState<any[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);

  async function loadSocialData(myUserId: string) {
    setSocialLoading(true);
    try {
      const [followsRes, followersRes] = await Promise.all([
        supabase
          .from("follows")
          .select("followed_id, followed:profiles (id, email, first_name, last_name, avatar_url)")
          .eq("follower_id", myUserId),
        supabase
          .from("follows")
          .select("follower_id, follower:profiles (id, email, first_name, last_name, avatar_url)")
          .eq("followed_id", myUserId),
      ]);

      if (followsRes.data) {
        setMyFollows(followsRes.data.map((f: any) => f.followed).filter(Boolean));
      }
      if (followersRes.data) {
        setMyFollowers(followersRes.data.map((f: any) => f.follower).filter(Boolean));
      }
    } catch (err) {
      console.error("Error loading social data:", err);
    } finally {
      setSocialLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, avatar_url")
        .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error("Error searching users:", err);
      toast("Erreur lors de la recherche", "⚠️");
    } finally {
      setSearchLoading(false);
    }
  }

  async function toggleFollow(targetUserId: string, isFollowing: boolean) {
    if (!userInfo) return;
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", userInfo.id)
          .eq("followed_id", targetUserId);
        if (error) throw error;
        toast("Désabonnement réussi", "🔕");
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({
            follower_id: userInfo.id,
            followed_id: targetUserId
          });
        if (error) throw error;
        toast("Abonnement réussi !", "🔔");
      }
      // Reload
      await loadSocialData(userInfo.id);
    } catch (err) {
      console.error("Error toggling follow:", err);
      toast("Une erreur est survenue", "⚠️");
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata;
        const name = meta?.first_name ? `${meta.first_name} ${meta.last_name || ""}`.trim() : (meta?.full_name ?? "Mon espace");
        const avatar = meta?.avatar_url ?? meta?.avatar ?? meta?.picture ?? undefined;
        setUserInfo({
          id: session.user.id,
          name,
          email: session.user.email ?? "",
          avatar,
        });
        setSyncOn(true);
        loadSocialData(session.user.id);
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
  const favoriteItems = [
    ...favoriteShows
      .map((id) => showCache[id])
      .filter(Boolean)
      .map((s) => ({ key: `show-${s.id}`, href: `/show/${s.id}`, item: s })),
    ...favoriteMovies
      .map((id) => movieCache[id])
      .filter(Boolean)
      .map((m) => ({ key: `movie-${m.id}`, href: `/movie/${m.id}`, item: m })),
    ...favoriteBooks
      .map((id) => bookCache[id])
      .filter(Boolean)
      .map((b) => ({ key: `book-${b.id}`, href: `/book/${b.id}`, item: b })),
  ];
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
        style={{ marginBottom: 20, gap: 16, padding: 20, alignItems: "center" }}
      >
        {userInfo?.avatar && (userInfo.avatar.startsWith("http") || userInfo.avatar.includes("/")) ? (
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
            {userInfo?.avatar || "🍿"}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{userInfo?.name ?? "Mon espace"}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {userInfo?.email ? `${userInfo.email} · ` : ""}
            {minutesHuman(showMinutes + movieMinutes) || "0 min"} au total
          </div>
        </div>
        {syncOn && (
          <button
            onClick={openEditModal}
            className="glass card pressable"
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              margin: 0,
              background: "var(--accent-wash)",
              borderColor: "var(--accent)",
              color: "var(--accent)",
            }}
          >
            ✏️ Modifier
          </button>
        )}
      </div>
      <div className="row" style={{ marginBottom: 20, gap: 10 }}>
        <button
          onClick={() => setActiveTab("stats")}
          className="glass card pressable"
          style={{
            flex: 1,
            padding: "10px",
            textAlign: "center",
            fontWeight: 700,
            background: activeTab === "stats" ? "var(--accent-wash)" : "transparent",
            borderColor: activeTab === "stats" ? "var(--accent)" : "var(--hairline)",
            color: activeTab === "stats" ? "var(--accent)" : "inherit",
          }}
        >
          📊 Stats & Préférences
        </button>
        <button
          onClick={() => setActiveTab("community")}
          className="glass card pressable"
          style={{
            flex: 1,
            padding: "10px",
            textAlign: "center",
            fontWeight: 700,
            background: activeTab === "community" ? "var(--accent-wash)" : "transparent",
            borderColor: activeTab === "community" ? "var(--accent)" : "var(--hairline)",
            color: activeTab === "community" ? "var(--accent)" : "inherit",
          }}
        >
          👥 Communauté
        </button>
      </div>

      {activeTab === "stats" ? (
        <>
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

          {/* Mes favoris */}
          {favoriteItems.length > 0 && (
            <>
              <h2 className="section-title">
                ❤️ Mes favoris{" "}
                <Link href="/collection/favorites" className="tiny" style={{ fontWeight: 700 }}>
                  Voir tout · {favoriteItems.length} →
                </Link>
              </h2>
              <div className="hscroll">
                {favoriteItems.slice(0, 12).map(({ key, href, item }) => (
                  <Link key={key} href={href} className="pressable">
                    <Poster
                      item={
                        "status" in item
                          ? { ...item, status: effectiveShowStatus(item, showStatus[item.id]) }
                          : item
                      }
                    />
                  </Link>
                ))}
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
                    <Poster item={{ ...s, status: effectiveShowStatus(s, showStatus[s.id]) }} />
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

            {/* Couleur d'accent */}
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
        </>
      ) : (
        <div className="stack" style={{ gap: 24 }}>
          {/* 1. Recherche d'amis */}
          <div className="glass card stack" style={{ gap: 14, padding: 20 }}>
            <h2 className="tiny" style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)" }}>
              🔍 RECHERCHER UN AMI
            </h2>
            <form onSubmit={handleSearch} className="row" style={{ gap: 8 }}>
              <input
                className="field"
                type="text"
                placeholder="Nom, prénom ou adresse email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary pressable" style={{ padding: "0 20px" }} disabled={searchLoading}>
                {searchLoading ? "..." : "Rechercher"}
              </button>
            </form>

            {searchResults.length > 0 ? (
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                {searchResults.map((user) => {
                  const isFollowing = myFollows.some((f) => f.id === user.id);
                  const isMe = userInfo?.id === user.id;
                  return (
                    <div key={user.id} className="row" style={{ alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                      <Link href={isMe ? "/profile" : `/profile/${user.id}`} className="row" style={{ alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-wash)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                          {user.avatar_url && (user.avatar_url.startsWith("http") || user.avatar_url.includes("/")) ? (
                            <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            user.avatar_url || "🍿"
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Membre GlassTime"}
                          </div>
                          <div className="tiny" style={{ color: "var(--text-3)" }}>{user.email}</div>
                        </div>
                      </Link>
                      
                      {!isMe && (
                        <button
                          onClick={() => toggleFollow(user.id, isFollowing)}
                          className="glass card pressable"
                          style={{
                            padding: "6px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            margin: 0,
                            background: isFollowing ? "transparent" : "var(--accent-wash)",
                            borderColor: isFollowing ? "var(--hairline)" : "var(--accent)",
                            color: isFollowing ? "var(--text-2)" : "var(--accent)",
                          }}
                        >
                          {isFollowing ? "🔕 Se désabonner" : "🔔 S'abonner"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : searchQuery.trim() && !searchLoading ? (
              <p className="tiny" style={{ color: "var(--text-3)", textAlign: "center", margin: "10px 0" }}>Aucun profil trouvé</p>
            ) : null}
          </div>

          {/* 2. Abonnements (les personnes qu'il suit) */}
          <div className="glass card stack" style={{ gap: 14, padding: 20 }}>
            <h2 className="tiny" style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)" }}>
              👥 MES ABONNEMENTS ({myFollows.length})
            </h2>
            {socialLoading ? (
              <p className="tiny" style={{ textAlign: "center" }}>Chargement des abonnements...</p>
            ) : myFollows.length > 0 ? (
              <div className="stack" style={{ gap: 10 }}>
                {myFollows.map((user) => (
                  <div key={user.id} className="row" style={{ alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                    <Link href={`/profile/${user.id}`} className="row" style={{ alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-wash)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                        {user.avatar_url && (user.avatar_url.startsWith("http") || user.avatar_url.includes("/")) ? (
                          <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          user.avatar_url || "🍿"
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Membre GlassTime"}
                        </div>
                        <div className="tiny" style={{ color: "var(--text-3)" }}>{user.email}</div>
                      </div>
                    </Link>
                    <button
                      onClick={() => toggleFollow(user.id, true)}
                      className="glass card pressable"
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        margin: 0,
                        borderColor: "var(--hairline)",
                        color: "var(--text-2)",
                      }}
                    >
                      🔕 Se désabonner
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="tiny" style={{ color: "var(--text-3)", textAlign: "center" }}>Vous ne suivez aucun utilisateur pour le moment.</p>
            )}
          </div>

          {/* 3. Abonnés (les personnes qui le suivent) */}
          <div className="glass card stack" style={{ gap: 14, padding: 20 }}>
            <h2 className="tiny" style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)" }}>
              👥 MES ABONNÉS ({myFollowers.length})
            </h2>
            {socialLoading ? (
              <p className="tiny" style={{ textAlign: "center" }}>Chargement des abonnés...</p>
            ) : myFollowers.length > 0 ? (
              <div className="stack" style={{ gap: 10 }}>
                {myFollowers.map((user) => {
                  const isFollowing = myFollows.some((f) => f.id === user.id);
                  return (
                    <div key={user.id} className="row" style={{ alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                      <Link href={`/profile/${user.id}`} className="row" style={{ alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-wash)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                          {user.avatar_url && (user.avatar_url.startsWith("http") || user.avatar_url.includes("/")) ? (
                            <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            user.avatar_url || "🍿"
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>
                            {user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Membre GlassTime"}
                          </div>
                          <div className="tiny" style={{ color: "var(--text-3)" }}>{user.email}</div>
                        </div>
                      </Link>
                      <button
                        onClick={() => toggleFollow(user.id, isFollowing)}
                        className="glass card pressable"
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          margin: 0,
                          background: isFollowing ? "transparent" : "var(--accent-wash)",
                          borderColor: isFollowing ? "var(--hairline)" : "var(--accent)",
                          color: isFollowing ? "var(--text-2)" : "var(--accent)",
                        }}
                      >
                        {isFollowing ? "🔕 Se désabonner" : "🔔 S'abonner"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="tiny" style={{ color: "var(--text-3)", textAlign: "center" }}>Aucun abonné pour le moment.</p>
            )}
          </div>
        </div>
      )}

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

      {isEditing && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="glass"
            style={{
              padding: 24,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 20,
              }}
            >
              Modifier le profil
            </h2>
            
            <form onSubmit={handleSaveProfile} className="stack" style={{ gap: 16 }}>
              <div className="stack" style={{ gap: 6 }}>
                <label className="tiny" style={{ fontWeight: 700, color: "var(--text-2)" }}>Nom / Prénom</label>
                <input
                  className="field"
                  type="text"
                  placeholder="Votre nom"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="stack" style={{ gap: 6 }}>
                <label className="tiny" style={{ fontWeight: 700, color: "var(--text-2)" }}>Avatar ou Emoji</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6, marginBottom: 8 }}>
                  {EMOJI_AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditAvatarUrl(emoji)}
                      style={{
                        padding: "8px 0",
                        fontSize: 20,
                        borderRadius: "var(--radius-sm)",
                        border: editAvatarUrl === emoji ? "2px solid var(--accent)" : "1px solid var(--hairline-strong)",
                        background: editAvatarUrl === emoji ? "var(--accent-wash)" : "var(--bg)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        outline: "none",
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="stack" style={{ gap: 4 }}>
                  <label className="tiny" style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Ou coller le lien d'une image (URL) :</label>
                  <input
                    className="field"
                    type="url"
                    placeholder="https://exemples.com/photo.jpg"
                    value={editAvatarUrl.startsWith("http") ? editAvatarUrl : ""}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ height: 1, background: "var(--hairline-strong)", margin: "8px 0" }} />

              <div className="stack" style={{ gap: 10 }}>
                <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-3)", letterSpacing: "0.05em", margin: "4px 0" }}>Changer de mot de passe</h3>
                
                <div className="stack" style={{ gap: 6 }}>
                  <label className="tiny" style={{ fontWeight: 700, color: "var(--text-2)" }}>Nouveau mot de passe</label>
                  <div style={{ position: "relative", width: "100%" }}>
                    <input
                      className="field"
                      type={showEditPassword ? "text" : "password"}
                      placeholder="Laisser vide pour ne pas changer"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      style={{ paddingRight: 46 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-3)",
                      }}
                    >
                      {showEditPassword ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {editPassword && (
                  <>
                    <div className="stack" style={{ gap: 6 }}>
                      <label className="tiny" style={{ fontWeight: 700, color: "var(--text-2)" }}>Confirmer le nouveau mot de passe</label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <input
                          className="field"
                          type={showEditConfirmPassword ? "text" : "password"}
                          placeholder="Confirmer"
                          value={editConfirmPassword}
                          onChange={(e) => setEditConfirmPassword(e.target.value)}
                          style={{ paddingRight: 46 }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                          style={{
                            position: "absolute",
                            right: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-3)",
                          }}
                        >
                          {showEditConfirmPassword ? (
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="stack" style={{ gap: 6 }}>
                      <label className="tiny" style={{ fontWeight: 700, color: "var(--text-2)" }}>Mot de passe actuel</label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <input
                          className="field"
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Saisir le mot de passe actuel"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          style={{ paddingRight: 46 }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          style={{
                            position: "absolute",
                            right: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-3)",
                          }}
                        >
                          {showCurrentPassword ? (
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {editError && (
                <p style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700, margin: "4px 0" }}>
                  ⚠️ {editError}
                </p>
              )}
              {editSuccess && (
                <p style={{ color: "var(--accent)", fontSize: 13, fontWeight: 700, margin: "4px 0" }}>
                  ✅ {editSuccess}
                </p>
              )}

              <div className="row" style={{ marginTop: 12, gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary pressable"
                  style={{ flex: 1, padding: "12px 0" }}
                  onClick={closeEditModal}
                  disabled={editLoading}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary pressable"
                  style={{ flex: 1, padding: "12px 0" }}
                  disabled={editLoading}
                >
                  {editLoading ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
