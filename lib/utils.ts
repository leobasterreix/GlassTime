import type { Episode, Show } from "./types";

export const DAY = 86400000;

export function epKey(s: number, e: number) {
  return `${s}:${e}`;
}

export function allEpisodes(show: Show): Episode[] {
  return show.seasons.flatMap((se) => se.episodes);
}

export function isAired(ep: Episode, now = Date.now()) {
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

/** Prochain épisode à venir (non diffusé). */
export function nextUpcoming(show: Show): Episode | null {
  const now = Date.now();
  for (const ep of allEpisodes(show)) {
    if (!isAired(ep, now)) return ep;
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
