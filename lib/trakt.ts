// Horaires réels de diffusion des épisodes via Trakt.tv — TMDB ne connaît que
// la date de diffusion, jamais l'heure. Trakt calcule ces horaires à partir
// des grilles TV réelles des chaînes, ce qui permet d'afficher "aujourd'hui à
// 22h" plutôt que juste "aujourd'hui". Best-effort partout : si Trakt n'a pas
// la série, échoue, ou si la clé n'est pas configurée, on retombe sur la date
// TMDB seule (aucune régression, juste moins précis).

import { epKey } from "./utils";

function hasTrakt() {
  return !!process.env.TRAKT_CLIENT_ID;
}

async function traktFetch(path: string) {
  const res = await fetch(`https://api.trakt.tv${path}`, {
    headers: {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": process.env.TRAKT_CLIENT_ID!,
      // Sans User-Agent, Node envoie une requête "nue" que Cloudflare (devant
      // l'API Trakt) bloque avec un 403 — un navigateur en envoie toujours un.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Trakt ${res.status} sur ${path}`);
  return res.json();
}

/**
 * Horaires réels (ISO complet, avec heure) de tous les épisodes d'une série,
 * à partir de son ID TMDB. Retourne une map "s:e" -> ISO datetime. Objet vide
 * si la série n'est pas trouvée sur Trakt ou en cas d'erreur/absence de clé.
 */
export async function getEpisodeAirTimes(tmdbId: number): Promise<Record<string, string>> {
  if (!hasTrakt()) return {};
  try {
    const matches = await traktFetch(`/search/tmdb/${tmdbId}?type=show`);
    const traktId = matches?.[0]?.show?.ids?.trakt;
    if (!traktId) return {};

    const seasons = await traktFetch(`/shows/${traktId}/seasons?extended=full,episodes`);
    const map: Record<string, string> = {};
    for (const season of seasons ?? []) {
      for (const ep of season.episodes ?? []) {
        if (ep.first_aired && typeof ep.season === "number" && typeof ep.number === "number") {
          map[epKey(ep.season, ep.number)] = ep.first_aired;
        }
      }
    }
    return map;
  } catch (err) {
    console.error("Trakt error getEpisodeAirTimes:", err);
    return {};
  }
}
