"use client";

import { useEffect, useState } from "react";
import { useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import { airedEpisodes, minutesHuman, watchedCount } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const mounted = useMounted();
  const { followed, watched, moviesWatched, showCache, movieCache, clearAll, theme, toggleTheme } =
    useTrack();
  useHydrateLibrary();

  const [userInfo, setUserInfo] = useState<{ name: string; email: string; avatar?: string } | null>(null);
  const [syncOn, setSyncOn] = useState<boolean | null>(null);

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

  const stats = [
    { value: String(episodesSeen), label: "épisodes vus" },
    { value: minutesHuman(showMinutes) || "0 min", label: "devant les séries" },
    { value: String(followed.length), label: "séries suivies" },
    { value: String(completed), label: "séries terminées" },
    { value: String(moviesWatched.length), label: "films vus" },
    { value: minutesHuman(movieMinutes) || "0 min", label: "devant les films" },
  ];

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
              border: "1px solid rgba(255,255,255,.25)",
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
              background:
                "linear-gradient(135deg, rgba(10,132,255,.5), rgba(191,90,242,.5))",
              border: "1px solid rgba(255,255,255,.25)",
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
          style={{ width: "100%", textAlign: "center", color: "#ff6b6b", fontWeight: 700 }}
          onClick={() => {
            if (confirm("Effacer toutes vos données de suivi ? Cette action est irréversible.")) {
              clearAll();
            }
          }}
        >
          Effacer mes données
        </button>
      </div>
    </main>
  );
}
