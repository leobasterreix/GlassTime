import type { Episode, Show } from "./types";
import type { ShowFollowStatus } from "./store";

export const DAY = 86400000;

/** Type élargi du badge/bandeau : le statut personnel « abandonnée » prime
 * visuellement sur le statut de diffusion (même si la série continue
 * d'être diffusée, l'afficher comme « active » n'aurait pas de sens). */
export type DisplayShowStatus = "En cours" | "Terminée" | "Abandonnée";
export type DisplayMovieStatus = "À voir" | "Vu";
export type DisplayBookStatus = "À lire" | "Lu";
/** Statut générique affichable en bandeau de couleur sur une affiche, tous
 * types de contenu confondus (séries, films, livres). */
export type DisplayStatus = DisplayShowStatus | DisplayMovieStatus | DisplayBookStatus;

/** Statuts « verts » (en cours / en liste) par opposition aux statuts
 * « violets » (terminé, plus rien à faire). Purement visuel : Poster n'a
 * plus besoin du texte pour distinguer les deux, seulement de la couleur. */
const ONGOING_STATUSES = new Set<DisplayStatus>(["En cours", "À voir", "À lire"]);

export function isOngoingStatus(status: DisplayStatus): boolean {
  return ONGOING_STATUSES.has(status);
}

/**
 * Combine le statut de diffusion (show.status, TMDB) et le statut personnel
 * de suivi (showStatus du store) en un seul statut à afficher : abandonnée
 * (violet) prend le pas sur terminée (violet aussi) puis sur en cours (vert).
 */
export function effectiveShowStatus(
  show: Show,
  personalStatus?: ShowFollowStatus
): DisplayShowStatus | undefined {
  if (personalStatus === "dropped") return "Abandonnée";
  return show.status;
}

export function movieStatus(
  inWatchlist: boolean,
  watched: boolean
): DisplayMovieStatus | undefined {
  if (watched) return "Vu";
  if (inWatchlist) return "À voir";
  return undefined;
}

export function bookStatus(
  inWatchlist: boolean,
  read: boolean
): DisplayBookStatus | undefined {
  if (read) return "Lu";
  if (inWatchlist) return "À lire";
  return undefined;
}

export function epKey(s: number, e: number) {
  return `${s}:${e}`;
}

export function allEpisodes(show: Show): Episode[] {
  return (show.seasons ?? []).flatMap((se) => se.episodes);
}

export function isAired(ep: Episode, now = Date.now()) {
  if (!ep.airDate) return false;
  return new Date(ep.airDate).getTime() <= now;
}

export function airedEpisodes(show: Show, now = Date.now()): Episode[] {
  return allEpisodes(show).filter((ep) => isAired(ep, now));
}

export function watchedCount(
  show: Show,
  watched: Record<string, true> | undefined
): number {
  if (!watched) return 0;
  return allEpisodes(show).filter((ep) => watched[epKey(ep.s, ep.e)]).length;
}

/** Premier épisode diffusé non vu, dans l'ordre. */
export function nextEpisode(
  show: Show,
  watched: Record<string, true> | undefined
): Episode | null {
  const now = Date.now();
  for (const ep of allEpisodes(show)) {
    if (!isAired(ep, now)) continue;
    if (!watched?.[epKey(ep.s, ep.e)]) return ep;
  }
  return null;
}

/** Prochain épisode à venir (non diffusé, date connue). */
export function nextUpcoming(show: Show): Episode | null {
  const now = Date.now();
  for (const ep of allEpisodes(show)) {
    if (ep.airDate && !isAired(ep, now)) return ep;
  }
  return null;
}

export function fmtDate(d: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(typeof d === "string" ? new Date(d) : d);
}

export function fmtDateLong(d: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(typeof d === "string" ? new Date(d) : d);
}

/** "aujourd'hui", "demain", "dans 3 j", "il y a 2 j" */
export function fmtRelative(d: string | Date): string {
  const t = (typeof d === "string" ? new Date(d) : d).getTime();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((t - startOfToday.getTime()) / DAY);
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "demain";
  if (diffDays === -1) return "hier";
  if (diffDays > 1) return `dans ${diffDays} j`;
  return `il y a ${-diffDays} j`;
}

/** Relatif si récent, sinon date complète ("le 4 juil. 2019"). */
export function fmtRelativeOrDate(d: string | Date, thresholdDays = 30): string {
  const t = (typeof d === "string" ? new Date(d) : d).getTime();
  if (Math.abs(t - Date.now()) / DAY > thresholdDays) {
    const full = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(t));
    return `le ${full}`;
  }
  return fmtRelative(d);
}

/** Un ISO datetime complet (Trakt) porte une heure ; une date seule (TMDB,
 * "YYYY-MM-DD") n'en porte pas — sert à savoir si on peut afficher l'heure. */
function hasTimeInfo(d: string): boolean {
  return d.length > 10;
}

/** fmtRelative, avec l'heure en plus quand elle est connue ("dans 3 j à 22h05"). */
export function fmtRelativeWithTime(d: string): string {
  const base = fmtRelative(d);
  if (!hasTimeInfo(d)) return base;
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));
  return `${base} à ${time}`;
}

/** fmtRelativeOrDate, avec l'heure en plus quand elle est connue. */
export function fmtRelativeOrDateWithTime(d: string, thresholdDays = 30): string {
  const base = fmtRelativeOrDate(d, thresholdDays);
  if (!hasTimeInfo(d)) return base;
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));
  return `${base} à ${time}`;
}

/** Index de jour local (nombre de jours depuis epoch, minuit local) — passer
 * par Date(y, m, d) + arrondi absorbe les décalages d'heure d'été, là où une
 * simple division de timestamps ISO donnerait des écarts de 23 h ou 25 h. */
function localDayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(new Date(y, m - 1, d).getTime() / DAY);
}

/** Streaks calculées depuis le journal d'activité (watchedLog, clés
 * YYYY-MM-DD locales). La streak courante ne casse pas si rien n'a encore
 * été marqué aujourd'hui : elle repart d'hier — on ne perd sa flamme qu'en
 * laissant passer un jour entier sans rien marquer. */
export function computeStreaks(log: Record<string, number>): {
  current: number;
  best: number;
} {
  const indices = Object.entries(log)
    .filter(([, n]) => n > 0)
    .map(([day]) => localDayIndex(day))
    .sort((a, b) => a - b);
  if (indices.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < indices.length; i++) {
    run = indices[i] - indices[i - 1] === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  const daySet = new Set(indices);
  const now = new Date();
  const todayIdx = Math.round(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / DAY
  );
  let cursor = daySet.has(todayIdx) ? todayIdx : todayIdx - 1;
  let current = 0;
  while (daySet.has(cursor)) {
    current++;
    cursor--;
  }

  return { current, best };
}

export function minutesHuman(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60 > 0 ? `${min % 60} min` : ""}`.trim();
  const d = Math.floor(h / 24);
  return `${d} j ${h % 24} h`;
}

export function epLabel(ep: Episode) {
  return `S${String(ep.s).padStart(2, "0")} · E${String(ep.e).padStart(2, "0")}`;
}

/** Notes GlassTime (user_reviews) : échelle 1-5 depuis ce changement, mais
 * d'anciennes notes restent stockées sur l'échelle 1-10 — on les ramène sur 5
 * à l'affichage plutôt que de migrer les données existantes. */
export function formatSiteRating(rating: number): string {
  const normalized = rating > 5 ? rating / 2 : rating;
  return Number.isInteger(normalized) ? normalized.toFixed(0) : normalized.toFixed(1);
}

/** Plateformes de streaming courantes proposées dans le sélecteur du profil
 * — mêmes noms que ceux reconnus par getProviderSearchUrl ci-dessous. */
export const KNOWN_PLATFORMS = [
  "Netflix",
  "Prime Video",
  "Disney+",
  "Canal+",
  "Max",
  "Paramount+",
  "Apple TV",
  "Crunchyroll",
];

export function isOwnedPlatform(myPlatforms: string[], providerName: string): boolean {
  const name = providerName.toLowerCase();
  return myPlatforms.some(
    (p) => name.includes(p.toLowerCase()) || p.toLowerCase().includes(name)
  );
}

export function getProviderSearchUrl(providerName: string, title: string, fallbackUrl?: string | null): string {
  const query = encodeURIComponent(title);
  const name = providerName.toLowerCase();
  if (name.includes("netflix")) {
    return `https://www.netflix.com/search?q=${query}`;
  }
  if (name.includes("prime video") || name.includes("amazon")) {
    return `https://www.primevideo.com/search/ref=atv_sr_sug?phrase=${query}`;
  }
  if (name.includes("disney")) {
    return `https://www.disneyplus.com/search?q=${query}`;
  }
  if (name.includes("canal") || name.includes("mycanal")) {
    return `https://www.canalplus.com/recherche?q=${query}`;
  }
  if (name.includes("max") || name.includes("hbo")) {
    return `https://www.max.com/search?q=${query}`;
  }
  if (name.includes("paramount")) {
    return `https://www.paramountplus.com/search?q=${query}`;
  }
  if (name.includes("apple tv") || name.includes("itunes")) {
    return `https://tv.apple.com/search?term=${query}`;
  }
  if (name.includes("crunchyroll")) {
    return `https://www.crunchyroll.com/search?q=${query}`;
  }
  return fallbackUrl || `https://www.google.com/search?q=Regarder+${query}+streaming`;
}
