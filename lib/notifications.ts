"use client";

// Notifications locales (appli ouverte) + pastille d'icône PWA.
// Un vrai push serveur (appli fermée) nécessiterait un cron + stockage
// d'abonnements — hors périmètre pour l'instant.

import type { Episode, Show } from "./types";
import { epLabel } from "./utils";

const PREF_KEY = "gt_notifs";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationsEnabled(): boolean {
  return (
    notificationsSupported() &&
    Notification.permission === "granted" &&
    localStorage.getItem(PREF_KEY) === "on"
  );
}

export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  localStorage.setItem(PREF_KEY, "on");
  return true;
}

export function disableNotifications() {
  localStorage.setItem(PREF_KEY, "off");
}

/** Notifie une fois par jour les épisodes diffusés aujourd'hui. */
export function notifyTodayEpisodes(entries: { show: Show; ep: Episode }[]) {
  if (!notificationsEnabled() || entries.length === 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const doneKey = `gt_notified_${today}`;
  if (localStorage.getItem(doneKey)) return;
  localStorage.setItem(doneKey, "1");
  const [first, ...rest] = entries;
  const body =
    rest.length > 0
      ? `${epLabel(first.ep)} et ${rest.length} autre${rest.length > 1 ? "s" : ""} épisode${rest.length > 1 ? "s" : ""} sortent aujourd'hui`
      : `${epLabel(first.ep)} — ${first.ep.title} sort aujourd'hui`;
  try {
    new Notification(`📺 ${first.show.title}`, { body, icon: "/icon.svg" });
  } catch {
    // Safari iOS exige un service worker : on ignore silencieusement
  }
}

/** Pastille sur l'icône PWA : nombre d'épisodes à rattraper. */
export function updateAppBadge(count: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (count > 0) nav.setAppBadge?.(count).catch(() => {});
  else nav.clearAppBadge?.().catch(() => {});
}
