"use client";

import { MOVIES, SHOWS } from "@/lib/data";
import { useMounted, useTrack } from "@/lib/store";
import { airedEpisodes, minutesHuman, watchedCount } from "@/lib/utils";

export default function ProfilePage() {
  const mounted = useMounted();
  const { followed, watched, moviesWatched } = useTrack();

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Profil</h1>
        <p className="page-sub">Vos statistiques</p>
      </main>
    );
  }

  const followedShows = SHOWS.filter((s) => followed.includes(s.id));
  const episodesSeen = SHOWS.reduce(
    (acc, s) => acc + watchedCount(s, watched[s.id]),
    0
  );
  const showMinutes = SHOWS.reduce(
    (acc, s) => acc + watchedCount(s, watched[s.id]) * s.runtime,
    0
  );
  const completed = followedShows.filter((s) => {
    const aired = airedEpisodes(s).length;
    return aired > 0 && watchedCount(s, watched[s.id]) >= aired;
  }).length;
  const moviesSeen = MOVIES.filter((m) => moviesWatched.includes(m.id));
  const movieMinutes = moviesSeen.reduce((acc, m) => acc + m.runtime, 0);

  // Genres favoris (pondérés par épisodes vus + films vus)
  const genreCount = new Map<string, number>();
  for (const s of SHOWS) {
    const n = watchedCount(s, watched[s.id]);
    if (n > 0) for (const g of s.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + n);
  }
  for (const m of moviesSeen)
    for (const g of m.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 3);
  const topGenres = Array.from(genreCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxGenre = topGenres[0]?.[1] ?? 1;

  const badges = [
    { emoji: "🎬", label: "Premier épisode", done: episodesSeen >= 1 },
    { emoji: "📚", label: "5 séries suivies", done: followed.length >= 5 },
    { emoji: "🏃", label: "Marathonien · 100 épisodes", done: episodesSeen >= 100 },
    { emoji: "🏆", label: "Série terminée", done: completed >= 1 },
    { emoji: "🍿", label: "Cinéphile · 10 films", done: moviesSeen.length >= 10 },
    { emoji: "⏰", label: "24 h de visionnage", done: showMinutes + movieMinutes >= 1440 },
  ];

  const stats = [
    { value: String(episodesSeen), label: "épisodes vus" },
    { value: minutesHuman(showMinutes) || "0 min", label: "devant les séries" },
    { value: String(followed.length), label: "séries suivies" },
    { value: String(completed), label: "séries terminées" },
    { value: String(moviesSeen.length), label: "films vus" },
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
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Mon espace</div>
          <div className="muted">
            {minutesHuman(showMinutes + movieMinutes) || "0 min"} de
            visionnage au total
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
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
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
      >
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
    </main>
  );
}
