"use client";

// Marquage d'épisodes avec feedback : toast d'enchaînement,
// célébration de fin de saison / de série.

import { toast } from "./toast";
import { useTrack } from "./store";
import type { Episode, Show } from "./types";
import { airedEpisodes, epKey, epLabel, isAired, nextEpisode } from "./utils";

/** Épisodes diffusés strictement antérieurs à `ep` (ordre des saisons). */
export function airedEpisodesBefore(show: Show, ep: Episode): Episode[] {
  const result: Episode[] = [];
  for (const season of show.seasons ?? []) {
    for (const e of season.episodes) {
      if (e.s > ep.s || (e.s === ep.s && e.e >= ep.e)) return result;
      if (isAired(e)) result.push(e);
    }
  }
  return result;
}

/**
 * Marque un épisode vu et affiche le bon feedback :
 * 🏆 série terminée, 🎉 saison terminée, sinon l'épisode suivant à voir.
 * Retourne le nombre d'épisodes diffusés antérieurs non vus (pour proposer
 * le rattrapage « marquer vu jusqu'ici »).
 */
export function markEpisodeWatched(show: Show, ep: Episode): number {
  const st = useTrack.getState();
  const before = airedEpisodesBefore(show, ep);
  const unseenBefore = before.filter(
    (e) => !st.watched[show.id]?.[epKey(e.s, e.e)]
  ).length;

  st.setEpisode(show.id, ep.s, ep.e, true);

  const map = useTrack.getState().watched[show.id];
  const aired = airedEpisodes(show);
  const allDone =
    aired.length > 0 && aired.every((e) => map?.[epKey(e.s, e.e)]);

  const season = (show.seasons ?? []).find((s) => s.n === ep.s);
  const seasonAired = season?.episodes.filter((e) => isAired(e)) ?? [];
  const seasonDone =
    seasonAired.length > 0 && seasonAired.every((e) => map?.[epKey(e.s, e.e)]);

  if (allDone) {
    toast(`${show.title} terminée. Bravo !`, "🏆");
  } else if (seasonDone) {
    toast(`Saison ${ep.s} de ${show.title} terminée !`, "🎉");
  } else {
    const next = nextEpisode(show, map);
    toast(
      next
        ? `${epLabel(ep)} vu · à suivre : ${epLabel(next)}`
        : `${epLabel(ep)} vu`,
      "✓"
    );
  }

  return unseenBefore;
}

/** Rattrapage : marque vus tous les épisodes diffusés jusqu'à `ep` inclus. */
export function markWatchedUpTo(show: Show, ep: Episode) {
  const st = useTrack.getState();
  const all = [...airedEpisodesBefore(show, ep), ep];
  const newly = all.filter(
    (e) => !st.watched[show.id]?.[epKey(e.s, e.e)]
  ).length;
  st.setEpisodes(
    show.id,
    all.map(({ s, e }) => ({ s, e })),
    true
  );
  toast(
    `${newly} épisode${newly > 1 ? "s" : ""} marqué${newly > 1 ? "s" : ""} vu${newly > 1 ? "s" : ""} jusqu'à ${epLabel(ep)}`,
    "⏩"
  );
}
