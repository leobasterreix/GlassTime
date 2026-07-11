"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Poster from "@/components/Poster";
import SyncIndicator from "@/components/SyncIndicator";
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
import {
  airedEpisodes,
  bookStatus,
  computeStreaks,
  DAY,
  effectiveShowStatus,
  KNOWN_PLATFORMS,
  minutesHuman,
  movieStatus,
  watchedCount,
} from "@/lib/utils";
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
  "showStatus",
  "watchedLog",
  "localReviews",
  "accent",
  "favoriteShows",
  "favoriteMovies",
  "favoriteBooks",
  "myPlatforms",
  "notifications",
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

/* ─── Interactive Heatmap sub-component ─── */
function HeatmapInteractive({
  heatmapColumns,
  watchedLog,
}: {
  heatmapColumns: string[][];
  watchedLog: Record<string, number>;
}) {
  const [selected, setSelected] = useState<{ day: string; count: number; rect: DOMRect } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!selected) return;
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelected(null);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [selected]);

  const handleCellClick = (day: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const count = watchedLog[day] || 0;
    setSelected((prev) => (prev?.day === day ? null : { day, count, rect }));
  };

  const formatDay = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  };

  return (
    <div ref={containerRef} className="glass card stack" style={{ padding: 18, gap: 12, position: "relative" }}>
      <div style={{ display: "flex", gap: 3.5, overflowX: "auto", paddingBottom: 6 }}>
        {heatmapColumns.map((col, cIdx) => (
          <div key={cIdx} style={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
            {col.map((day) => {
              const count = watchedLog[day] || 0;
              let bg = "var(--glass-border)";
              let opacity = 1;
              if (count > 0) {
                bg = "var(--accent)";
                if (count === 1) opacity = 0.25;
                else if (count <= 3) opacity = 0.55;
                else if (count <= 5) opacity = 0.8;
                else opacity = 1;
              }
              const isSelected = selected?.day === day;
              return (
                <div
                  key={day}
                  onClick={(e) => handleCellClick(day, e)}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: bg,
                    opacity,
                    cursor: "pointer",
                    outline: isSelected ? "2px solid var(--accent)" : "none",
                    outlineOffset: 1,
                    transition: "background 0.2s, opacity 0.2s, outline 0.15s",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Floating tooltip */}
      {selected && containerRef.current && (() => {
        const containerRect = containerRef.current!.getBoundingClientRect();
        const left = selected.rect.left - containerRect.left + selected.rect.width / 2;
        const top = selected.rect.top - containerRect.top - 8;
        return (
          <div
            style={{
              position: "absolute",
              left: Math.max(50, Math.min(left, containerRect.width - 50)),
              top,
              transform: "translate(-50%, -100%)",
              background: "var(--card-bg)",
              border: "1px solid var(--glass-border)",
              borderRadius: 10,
              padding: "8px 14px",
              zIndex: 20,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              animation: "tooltip-in 0.2s ease",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", marginBottom: 2 }}>
              {formatDay(selected.day)}
            </div>
            <div style={{ fontSize: 11, color: selected.count > 0 ? "var(--accent)" : "var(--text-3)" }}>
              {selected.count > 0
                ? `${selected.count} activité${selected.count > 1 ? "s" : ""}`
                : "Aucune activité"}
            </div>
          </div>
        );
      })()}

      <div className="row" style={{ justifyContent: "space-between", fontSize: 11, color: "var(--text-3)" }}>
        <span>Il y a 20 semaines</span>
        <div className="row" style={{ gap: 4, alignItems: "center" }}>
          <span>Moins</span>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--glass-border)" }} />
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)", opacity: 0.25 }} />
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)", opacity: 0.55 }} />
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)", opacity: 0.8 }} />
          <div style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)", opacity: 1 }} />
          <span>Plus</span>
        </div>
        <span>Aujourd'hui</span>
      </div>
    </div>
  );
}

/* ─── Interactive Donut sub-component ─── */
type DonutSlice = {
  name: string;
  count: number;
  percent: number;
  color: string;
  strokeLength: number;
  strokeOffset: number;
};

function DonutInteractive({ donutSlices }: { donutSlices: DonutSlice[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const active = activeIdx !== null ? donutSlices[activeIdx] : null;

  return (
    <div
      className="glass card row"
      style={{ gap: 24, padding: 20, alignItems: "center", justifyContent: "space-around", flexWrap: "wrap" }}
    >
      <div
        style={{ display: "flex", justifyContent: "center", position: "relative" }}
        onMouseLeave={() => setActiveIdx(null)}
      >
        <svg width="140" height="140" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", borderRadius: "50%" }}>
          <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--hairline)" strokeWidth="12" />
          {donutSlices.map((slice, idx) => (
            <circle
              key={idx}
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke={slice.color}
              strokeWidth={activeIdx === idx ? 16 : 12}
              strokeDasharray={`${slice.strokeLength} 251.2`}
              strokeDashoffset={slice.strokeOffset}
              strokeLinecap="round"
              style={{
                transition: "stroke-width 0.25s ease, opacity 0.25s ease",
                opacity: activeIdx !== null && activeIdx !== idx ? 0.35 : 1,
                cursor: "pointer",
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => setActiveIdx((p) => (p === idx ? null : idx))}
            />
          ))}
        </svg>
        {/* Center label */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
            transition: "opacity 0.2s",
          }}
        >
          {active ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, color: active.color, lineHeight: 1.1 }}>
                {active.percent}%
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-2)", marginTop: 2, maxWidth: 60, lineHeight: 1.2 }}>
                {active.name}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 500 }}>
              Survoler
            </div>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: 10, flex: 1, minWidth: 160 }}>
        {donutSlices.map((slice, idx) => (
          <div
            key={idx}
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13.5,
              padding: "4px 8px",
              borderRadius: 8,
              cursor: "pointer",
              background: activeIdx === idx ? "var(--glass-bg)" : "transparent",
              transition: "background 0.2s",
            }}
            onMouseEnter={() => setActiveIdx(idx)}
            onMouseLeave={() => setActiveIdx(null)}
            onClick={() => setActiveIdx((p) => (p === idx ? null : idx))}
          >
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: slice.color,
                  transition: "transform 0.2s",
                  transform: activeIdx === idx ? "scale(1.3)" : "scale(1)",
                }}
              />
              <span style={{ fontWeight: 600 }}>{slice.name}</span>
            </div>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {slice.count} ({slice.percent}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type GoalKind = "episodes" | "movies" | "books";

const GOAL_DEFS: { kind: GoalKind; emoji: string; label: string }[] = [
  { kind: "episodes", emoji: "📺", label: "Épisodes" },
  { kind: "movies", emoji: "🎬", label: "Films" },
  { kind: "books", emoji: "📚", label: "Livres" },
];

/** Objectifs annuels façon défi lecture Goodreads : cible par catégorie,
 * progression sur l'année en cours et projection au rythme actuel. */
function YearlyGoalsCard({
  counts,
  goals,
  setGoal,
}: {
  counts: Record<GoalKind, number>;
  goals: Record<GoalKind, number | null>;
  setGoal: (kind: GoalKind, value: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<GoalKind, string>>({
    episodes: "",
    movies: "",
    books: "",
  });

  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1).getTime();
  const daysInYear = Math.round((new Date(year + 1, 0, 1).getTime() - startOfYear) / DAY);
  const dayOfYear = Math.max(1, Math.floor((Date.now() - startOfYear) / DAY) + 1);

  const active = GOAL_DEFS.filter((g) => (goals[g.kind] ?? 0) > 0);

  function openEdit() {
    setDraft({
      episodes: goals.episodes ? String(goals.episodes) : "",
      movies: goals.movies ? String(goals.movies) : "",
      books: goals.books ? String(goals.books) : "",
    });
    setEditing(true);
  }

  function save() {
    for (const g of GOAL_DEFS) {
      const n = parseInt(draft[g.kind], 10);
      setGoal(g.kind, Number.isFinite(n) && n > 0 ? n : null);
    }
    setEditing(false);
    toast(`Objectifs ${year} enregistrés`, "🎯");
  }

  if (editing) {
    return (
      <div className="glass card stack" style={{ gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Mes objectifs {year}</span>
        {GOAL_DEFS.map((g) => (
          <div key={g.kind} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 13.5 }}>
              {g.emoji} {g.label} sur l&apos;année
            </span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="—"
              value={draft[g.kind]}
              onChange={(e) => setDraft((d) => ({ ...d, [g.kind]: e.target.value }))}
              style={{
                width: 90,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--hairline-strong)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontWeight: 700,
                textAlign: "center",
              }}
            />
          </div>
        ))}
        <div className="row" style={{ gap: 10 }}>
          <button className="btn pressable" style={{ flex: 1 }} onClick={() => setEditing(false)}>
            Annuler
          </button>
          <button className="btn btn-primary pressable" style={{ flex: 1 }} onClick={save}>
            Enregistrer
          </button>
        </div>
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="glass card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 30, marginBottom: 6 }}>🎯</div>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Aucun objectif {year}</div>
        <p className="tiny" style={{ marginBottom: 14 }}>
          Fixe-toi un cap pour l&apos;année — épisodes, films ou livres — et suis ta progression ici.
        </p>
        <button className="btn btn-primary pressable" onClick={openEdit}>
          Définir mes objectifs
        </button>
      </div>
    );
  }

  return (
    <div className="glass card stack" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Mes objectifs {year}</span>
        <button className="tiny pressable" style={{ fontWeight: 700, color: "var(--accent)" }} onClick={openEdit}>
          ✏️ Modifier
        </button>
      </div>
      {active.map((g) => {
        const goal = goals[g.kind]!;
        const count = counts[g.kind];
        const pct = Math.min(100, Math.round((count / goal) * 100));
        const projected = Math.round((count / dayOfYear) * daysInYear);
        const reached = count >= goal;
        return (
          <div key={g.kind}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                {g.emoji} {g.label}
              </span>
              <span className="tiny" style={{ fontWeight: 700 }}>
                {count} / {goal}
              </span>
            </div>
            <div className="progress">
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="tiny" style={{ marginTop: 4, color: reached ? "var(--accent)" : "var(--text-3)" }}>
              {reached
                ? "🎉 Objectif atteint, bravo !"
                : `À ce rythme : ~${projected} d'ici fin ${year}`}
            </div>
          </div>
        );
      })}
    </div>
  );
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
    localReviews,
    episodeReviews,
    episodeWatchedAt,
    importState,
    clearAll,
    theme,
    toggleTheme,
    accent,
    setAccent,
    ambiance,
    setAmbiance,
    glassIntensity,
    setGlassIntensity,
    avatarEmoji,
    setAvatarEmoji,
    yearlyGoals,
    setYearlyGoal,
    favoriteShows,
    favoriteMovies,
    favoriteBooks,
    myPlatforms,
    toggleMyPlatform,
    lastSeenActivityAt,
    setLastSeenActivityAt,
    subscriptionPlan,
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

  const [activeTab, setActiveTab] = useState<"stats" | "settings" | "community">("stats");
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
          .select("followed_id, followed:profiles (id, email, first_name, last_name, avatar_url, public_state)")
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

  // Recharge le flux d'amis à chaque ouverture de l'onglet Communauté, pas
  // seulement au chargement de la page (sinon les nouvelles activités des
  // amis restent invisibles jusqu'au rechargement complet de l'appli).
  useEffect(() => {
    if (activeTab === "community" && userInfo) {
      loadSocialData(userInfo.id);
      setLastSeenActivityAt(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userInfo?.id]);

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

  // Streaks : jours consécutifs avec au moins un marquage (épisode, film ou
  // livre) — le journal watchedLog couvre déjà les trois types de contenu.
  const streaks = computeStreaks(watchedLog);

  // Progression des objectifs : comptes de l'année en cours uniquement. Les
  // épisodes marqués avant l'ajout de l'horodatage n'ont pas de date — ils ne
  // comptent pas ici, ce qui est le comportement voulu (objectif = activité
  // réelle de l'année, pas le stock historique).
  const goalYear = String(new Date().getFullYear());
  const yearCounts = {
    episodes: Object.values(episodeWatchedAt ?? {}).filter((d) => d.startsWith(goalYear)).length,
    movies: Object.values(moviesWatchedDates ?? {}).filter((d) => d.startsWith(goalYear)).length,
    books: Object.values(booksReadDates ?? {}).filter((d) => d.startsWith(goalYear)).length,
  };
  const reviewsCount =
    Object.keys(localReviews ?? {}).length + Object.keys(episodeReviews ?? {}).length;

  const badges = [
    { emoji: "🎬", label: "Premier épisode", done: episodesSeen >= 1 },
    { emoji: "📚", label: "5 séries suivies", done: followed.length >= 5 },
    { emoji: "🏃", label: "Marathonien · 100 épisodes", done: episodesSeen >= 100 },
    { emoji: "🚀", label: "Boulimique · 500 épisodes", done: episodesSeen >= 500 },
    { emoji: "🏆", label: "Série terminée", done: completed >= 1 },
    { emoji: "🍿", label: "Cinéphile · 10 films", done: moviesWatched.length >= 10 },
    { emoji: "📖", label: "Premier livre lu", done: booksRead.length >= 1 },
    { emoji: "✍️", label: "Premier avis publié", done: reviewsCount >= 1 },
    { emoji: "🧭", label: "Explorateur · 5 genres", done: genreCount.size >= 5 },
    { emoji: "⏰", label: "24 h de visionnage", done: showMinutes + movieMinutes >= 1440 },
    { emoji: "📆", label: "7 jours de visionnage", done: showMinutes + movieMinutes >= 10080 },
    { emoji: "🔥", label: "Streak · 3 jours", done: streaks.best >= 3 },
    { emoji: "🧨", label: "Streak · 7 jours", done: streaks.best >= 7 },
    { emoji: "🌋", label: "Streak · 30 jours", done: streaks.best >= 30 },
  ];

  // Collections (fiches disponibles dans le cache local)
  const favoriteItems = [
    ...favoriteShows
      .map((id) => showCache[id])
      .filter(Boolean)
      .map((s) => ({
        key: `show-${s.id}`,
        href: `/show/${s.id}`,
        item: { ...s, status: effectiveShowStatus(s, showStatus[s.id]) },
      })),
    ...favoriteMovies
      .map((id) => movieCache[id])
      .filter(Boolean)
      .map((m) => ({
        key: `movie-${m.id}`,
        href: `/movie/${m.id}`,
        item: {
          ...m,
          status: movieStatus(movieWatchlist.includes(m.id), moviesWatched.includes(m.id)),
        },
      })),
    ...favoriteBooks
      .map((id) => bookCache[id])
      .filter(Boolean)
      .map((b) => ({
        key: `book-${b.id}`,
        href: `/book/${b.id}`,
        item: {
          ...b,
          status: bookStatus(booksWatchlist.includes(b.id), booksRead.includes(b.id)),
        },
      })),
  ];
  const myShows = followed.map((id) => showCache[id]).filter(Boolean);
  const friendActivities = (myFollows || []).flatMap((friend: any) => {
    const activities = friend.public_state?.recentActivities || [];
    return activities.map((act: any) => ({
      ...act,
      friend
    }));
  }).sort((a: any, b: any) => b.timestamp - a.timestamp);
  const hasNewFriendActivity =
    activeTab !== "community" &&
    friendActivities.some((a: any) => a.timestamp > lastSeenActivityAt);
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

  function renderActivityCard(act: any) {
    const friend = act.friend;
    const dateStr = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(act.timestamp));

    let icon = "🔔";
    let text = "";
    if (act.type === "watch-episode") {
      icon = "📺";
      text = `a regardé un épisode de ${act.mediaTitle}`;
    } else if (act.type === "watch-movie") {
      icon = "🎬";
      text = `a regardé le film ${act.mediaTitle}`;
    } else if (act.type === "read-book") {
      icon = "📖";
      text = `a terminé le livre ${act.mediaTitle}`;
    } else if (act.type === "read-progress") {
      icon = "📚";
      text = `lit le livre ${act.mediaTitle}`;
    } else if (act.type === "review-episode") {
      icon = "💬";
      text = `a donné son avis sur un épisode de ${act.mediaTitle}`;
    }

    return (
      <div key={act.id} className="glass card row" style={{ gap: 12, padding: 14, alignItems: "flex-start" }}>
        {/* Avatar du copain */}
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--accent-wash)", border: "1px solid var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          {friend.avatar_url && (friend.avatar_url.startsWith("http") || friend.avatar_url.includes("/")) ? (
            <img src={friend.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            friend.avatar_url || "🍿"
          )}
        </div>

        {/* Détails de l'activité */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>
            {friend.first_name ? `${friend.first_name} ${friend.last_name || ""}`.trim() : "Un ami"}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 15 }}>{icon}</span>
            <span>{text}</span>
          </div>
          {act.details && (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--glass-border)",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 12.5,
              marginTop: 6,
              color: "var(--text-2)",
              fontStyle: "italic",
              lineHeight: 1.3
            }}>
              {act.details}
            </div>
          )}
          <div className="tiny" style={{ marginTop: 6, color: "var(--text-3)", fontSize: 11 }}>
            {dateStr}
          </div>
        </div>

        {/* Poster de l'œuvre à droite */}
        {act.mediaPoster && (
          <div style={{ width: 42, height: 60, borderRadius: 6, overflow: "hidden", border: "1px solid var(--glass-border)", flexShrink: 0 }}>
            <img src={act.mediaPoster} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
      </div>
    );
  }

  // Heatmap calculation
  const heatmapDays: string[] = [];
  const startDay = new Date();
  startDay.setDate(startDay.getDate() - 139); // 140 jours (20 semaines)
  for (let i = 0; i < 140; i++) {
    const current = new Date(startDay);
    current.setDate(startDay.getDate() + i);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    heatmapDays.push(`${yyyy}-${mm}-${dd}`);
  }

  const heatmapColumns: string[][] = [];
  for (let c = 0; c < 20; c++) {
    heatmapColumns.push(heatmapDays.slice(c * 7, (c + 1) * 7));
  }

  // Genres calculation
  const genreCounts: Record<string, number> = {};
  myShows.forEach((s) => {
    (s.genres || []).forEach((g: string) => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
  });
  moviesSeen.forEach((m) => {
    (m.genres || []).forEach((g: string) => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
  });
  const sortedGenres = Object.entries(genreCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5);

  const totalGenreCount = sortedGenres.reduce((acc, g) => acc + g.count, 0);

  const DONUT_COLORS = [
    "var(--accent)",
    "#ff4757",
    "#2ed573",
    "#ffa502",
    "#1e90ff"
  ];

  let cumulativePercent = 0;
  const donutSlices = sortedGenres.map((g, i) => {
    const percent = totalGenreCount > 0 ? (g.count / totalGenreCount) * 100 : 0;
    const strokeLength = (percent / 100) * 251.2;
    const strokeOffset = (cumulativePercent / 100) * 251.2;
    cumulativePercent += percent;
    return {
      name: g.name,
      count: g.count,
      percent: Math.round(percent),
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      strokeLength,
      strokeOffset: -strokeOffset
    };
  });

  return (
    <main className="page" style={{ paddingTop: 0 }}>
      {/* En-tête collant (sticky) : Titre, Infos Profil et Onglets segmentés */}
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
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: 28 }}>Profil</h1>
            <p className="page-sub" style={{ margin: 0, marginTop: 2 }}>Vos statistiques</p>
          </div>
          <SyncIndicator />
        </div>

        <div
          className="glass card row"
          style={{ marginBottom: 12, gap: 16, padding: "12px 16px", alignItems: "center" }}
        >
          {userInfo?.avatar && (userInfo.avatar.startsWith("http") || userInfo.avatar.includes("/")) ? (
            <img
              src={userInfo.avatar}
              alt="Avatar"
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "1px solid var(--glass-border)",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                background: "var(--accent-wash)",
                border: "1px solid var(--accent)",
              }}
            >
              {userInfo?.avatar || avatarEmoji || "🍿"}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{userInfo?.name ?? "Mon espace"}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {userInfo?.email ? `${userInfo.email} · ` : ""}
              {minutesHuman(showMinutes + movieMinutes) || "0 min"} au total
            </div>
          </div>
          {syncOn && (
            <button
              onClick={openEditModal}
              className="glass card pressable"
              style={{
                padding: "6px 12px",
                fontSize: 12,
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

        <div className="glass segmented" style={{ marginBottom: 0 }}>
          <button
            className={activeTab === "stats" ? "active" : ""}
            onClick={() => setActiveTab("stats")}
          >
            📊 Stats
          </button>
          <button
            className={activeTab === "settings" ? "active" : ""}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ Préférences
          </button>
          <button
            className={activeTab === "community" ? "active" : ""}
            onClick={() => setActiveTab("community")}
            style={{ position: "relative" }}
          >
            👥 Communauté
            {hasNewFriendActivity && (
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 4,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--danger, #ff4757)",
                }}
              />
            )}
          </button>
        </div>
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

          {/* Streak — jours consécutifs avec activité */}
          <div
            className="glass card row"
            style={{
              gap: 14,
              alignItems: "center",
              marginTop: 14,
              ...(streaks.current > 0
                ? { background: "var(--accent-wash)", borderColor: "var(--accent)" }
                : {}),
            }}
          >
            <span style={{ fontSize: 34, filter: streaks.current > 0 ? "none" : "grayscale(1)", opacity: streaks.current > 0 ? 1 : 0.6 }}>
              🔥
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {streaks.current > 0
                  ? `${streaks.current} jour${streaks.current > 1 ? "s" : ""} d'affilée`
                  : "Pas de streak en cours"}
              </div>
              <div className="tiny" style={{ marginTop: 2 }}>
                {streaks.current > 0
                  ? "Marque quelque chose chaque jour pour garder ta flamme."
                  : "Marque un épisode, un film ou un livre pour lancer une streak."}
                {streaks.best > 1 && ` Record : ${streaks.best} jours.`}
              </div>
            </div>
          </div>

          {/* Objectifs annuels */}
          <h2 className="section-title">Objectifs 🎯</h2>
          <YearlyGoalsCard
            counts={yearCounts}
            goals={yearlyGoals ?? { episodes: null, movies: null, books: null }}
            setGoal={setYearlyGoal}
          />

          {/* Heatmap d'activité — interactive */}
          <h2 className="section-title">Calendrier d'activité 🗓️</h2>
          <HeatmapInteractive heatmapColumns={heatmapColumns} watchedLog={watchedLog} />

          {/* Genres favoris */}
          {totalGenreCount > 0 && (
            <>
              <h2 className="section-title">Genres favoris 📊</h2>
              <DonutInteractive donutSlices={donutSlices} />
            </>
          )}

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
                    <Poster item={item} />
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
                        <Poster item={{ ...m, status: movieStatus(true, false) }} />
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
                        <Poster item={{ ...m, status: movieStatus(false, true) }} />
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
                        <Poster item={{ ...b, status: bookStatus(true, false) }} />
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
                        <Poster item={{ ...b, status: bookStatus(false, true) }} />
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

          <h2 className="section-title">
            Badges<small>{badges.filter((b) => b.done).length}/{badges.length}</small>
          </h2>
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
        </>
      ) : activeTab === "settings" ? (
        <>
          <h2 className="section-title">Mon abonnement</h2>
          <div className="glass card" style={{ padding: 18, marginBottom: 20 }}>
            {subscriptionPlan === "premium" ? (
              <>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)" }}>
                    ✨ Premium actif
                  </span>
                </div>
                <p className="muted" style={{ fontSize: 13 }}>
                  Merci pour votre soutien ! Gérez ou résiliez votre abonnement
                  directement depuis votre espace client Lemon Squeezy (lien envoyé
                  par e-mail à la confirmation de paiement).
                </p>
              </>
            ) : (
              <>
                <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>Plan Gratuit</span>
                </div>
                <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                  Passez Premium pour suivre séries et livres en illimité, synchroniser
                  tous vos appareils et débloquer le picker « Ce soir, je regarde quoi ? ».
                </p>
                {(() => {
                  const buyUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_BUY_URL;
                  if (!buyUrl) {
                    return (
                      <p className="tiny" style={{ color: "var(--text-3)" }}>
                        L'abonnement Premium n'est pas encore disponible à l'achat.
                      </p>
                    );
                  }
                  const params = new URLSearchParams({
                    "checkout[email]": userInfo?.email || "",
                    "checkout[custom][user_id]": userInfo?.id || "",
                  });
                  return (
                    <a
                      href={`${buyUrl}?${params.toString()}`}
                      className="btn btn-primary pressable"
                      style={{ width: "100%" }}
                    >
                      ✨ Passer Premium — 3,99€/mois
                    </a>
                  );
                })()}
              </>
            )}
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
                    value={accent ?? ACCENT_PRESETS[0].swatch}
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
            {/* Fond d'ambiance */}
            <div className="glass card stack" style={{ gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Ambiance</span>
              <p className="tiny">Halo de couleur en fond d&apos;écran, derrière le contenu.</p>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {(
                  [
                    { value: "aurora", label: "✨ Aurora" },
                    { value: "sunset", label: "🌇 Crépuscule" },
                    { value: "ocean", label: "🌊 Océan" },
                    { value: "forest", label: "🌲 Forêt" },
                    { value: "none", label: "🚫 Aucune" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.value}
                    className={`chip pressable${(ambiance ?? "aurora") === o.value ? " active" : ""}`}
                    style={{ width: "auto", minWidth: "auto" }}
                    onClick={() => setAmbiance(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Intensité de l'effet verre */}
            <div className="glass card stack" style={{ gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Effet verre</span>
              <p className="tiny">« Intense » rend les cartes translucides avec flou d&apos;arrière-plan.</p>
              <div className="glass segmented" style={{ marginBottom: 0 }}>
                {(
                  [
                    { value: "subtle", label: "Discret" },
                    { value: "normal", label: "Normal" },
                    { value: "intense", label: "Intense" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.value}
                    className={(glassIntensity ?? "normal") === o.value ? "active" : ""}
                    onClick={() => setGlassIntensity(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Avatar emoji (sans compte) */}
            <div className="glass card stack" style={{ gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Avatar</span>
              <p className="tiny">
                Ton emoji d&apos;avatar, même sans compte.
                {userInfo?.avatar ? " L'avatar de ton compte reste prioritaire." : ""}
              </p>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {["🍿", "📺", "🎬", "📚", "🎭", "🎮", "🚀", "🌙", "⭐", "🔥", "🦊", "🐼", "🐱", "🦄", "👾", "🤖"].map((e) => {
                  const active = avatarEmoji === e;
                  return (
                    <button
                      key={e}
                      className="pressable"
                      aria-label={`Avatar ${e}`}
                      onClick={() => setAvatarEmoji(active ? null : e)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        fontSize: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        background: active ? "var(--accent-wash)" : "var(--surface-2)",
                        border: active ? "2px solid var(--accent)" : "1px solid var(--hairline)",
                      }}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Plateformes de streaming possédées */}
            <div className="glass card stack" style={{ gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Mes plateformes</span>
              <p className="tiny">Utilisé pour mettre en avant vos plateformes sur les fiches séries et films.</p>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {KNOWN_PLATFORMS.map((name) => {
                  const active = myPlatforms.includes(name);
                  return (
                    <button
                      key={name}
                      className={`chip pressable${active ? " active" : ""}`}
                      style={{ width: "auto", minWidth: "auto" }}
                      onClick={() => toggleMyPlatform(name)}
                    >
                      {active ? "✓ " : ""}
                      {name}
                    </button>
                  );
                })}
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
              className="pressable"
              style={{
                width: "100%",
                textAlign: "center",
                color: "var(--danger)",
                fontWeight: 600,
                fontSize: 13,
                background: "none",
                border: "none",
                padding: "12px 0",
                marginTop: 24,
                borderTop: "1px solid var(--hairline)",
              }}
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
          {/* Flux d'activité des amis */}
          <div>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>Flux d'activité des amis 👥</h2>
              <button
                className="tiny pressable"
                style={{ fontWeight: 700 }}
                disabled={socialLoading}
                onClick={() => userInfo && loadSocialData(userInfo.id)}
              >
                {socialLoading ? "…" : "↻ Actualiser"}
              </button>
            </div>
            {friendActivities.length === 0 ? (
              <div className="glass card" style={{ textAlign: "center", padding: 30 }}>
                <span className="muted" style={{ fontSize: 14 }}>
                  Aucune activité récente de vos amis. Suivez des amis pour voir leur progression !
                </span>
              </div>
            ) : (
              <div className="stack" style={{ gap: 12 }}>
                {friendActivities.map(renderActivityCard)}
              </div>
            )}
          </div>

          {/* Communauté */}
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
                      className="pressable"
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
                          className="pressable"
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
                          className="pressable"
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
                <p className="field-error-in" style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700, margin: "4px 0" }}>
                  ⚠️ {editError}
                </p>
              )}
              {editSuccess && (
                <p className="field-error-in" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 700, margin: "4px 0" }}>
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
