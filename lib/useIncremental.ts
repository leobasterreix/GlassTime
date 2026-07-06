"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Rendu incrémental des longues listes : au lieu de monter des milliers de
 * cartes d'un coup (historique complet, prochaines diffusions), on n'en rend
 * qu'un premier paquet, et on en révèle davantage à mesure qu'une sentinelle
 * placée en bas de la liste approche du viewport. Le DOM reste léger même avec
 * un historique énorme — c'est ce qui faisait ramer Safari sur iPad.
 *
 * Adapté au défilement de la fenêtre (pas de conteneur à hauteur fixe), donc
 * compatible avec les cartes de hauteur variable de l'agenda.
 */
export function useIncremental<T>(
  items: T[],
  { step = 24, fromEnd = false }: { step?: number; fromEnd?: boolean } = {}
): { visible: T[]; sentinelRef: React.RefObject<HTMLDivElement | null>; hasMore: boolean } {
  const [count, setCount] = useState(step);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = count < items.length;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setCount((c) => c + step);
        }
      },
      // Marge généreuse : on charge le paquet suivant avant que la sentinelle
      // n'entre réellement à l'écran, pour un défilement sans à-coups.
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, step, items.length]);

  // fromEnd : listes affichées AU-DESSUS du point d'ancrage (historique, tri
  // ascendant) — on garde la fin de la liste (le plus récent, près du pli) et
  // on révèle le passé plus ancien à mesure qu'on remonte, sentinelle en tête.
  const visible = fromEnd ? items.slice(Math.max(0, items.length - count)) : items.slice(0, count);

  return { visible, sentinelRef, hasMore };
}
