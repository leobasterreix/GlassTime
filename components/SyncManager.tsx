"use client";

import { useEffect } from "react";
import { useTrack } from "@/lib/store";

// Synchronisation multi-appareils via /api/sync (Redis KV).
// Au chargement : le plus récent (local ou serveur) gagne, d'après updatedAt.
// Ensuite : chaque modification locale est poussée après 1,5 s d'inactivité.

const SYNC_KEYS = [
  "followed",
  "watched",
  "movieWatchlist",
  "moviesWatched",
  "showCache",
  "movieCache",
  "updatedAt",
] as const;

type SyncState = Record<string, unknown> & { updatedAt?: number };

function snapshot(): SyncState {
  const st = useTrack.getState() as unknown as Record<string, unknown>;
  return Object.fromEntries(SYNC_KEYS.map((k) => [k, st[k]]));
}

async function push() {
  try {
    await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: snapshot() }),
    });
  } catch {
    // hors ligne : la prochaine modification retentera
  }
}

export default function SyncManager() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsub = () => {};
    let applying = false;

    (async () => {
      try {
        const res = await fetch("/api/sync");
        if (!res.ok) return; // KV en erreur : on reste en local
        const data = await res.json();
        if (!data.configured) return; // pas de base : mode local uniquement

        const server: SyncState | null = data.state;
        const localUpdated = useTrack.getState().updatedAt ?? 0;
        const serverUpdated = server?.updatedAt ?? 0;

        if (server && serverUpdated > localUpdated) {
          applying = true;
          useTrack.setState(server);
          applying = false;
        } else if (localUpdated > serverUpdated) {
          void push();
        }

        // Abonnement après réconciliation initiale seulement
        unsub = useTrack.subscribe(() => {
          if (applying) return;
          clearTimeout(timer);
          timer = setTimeout(push, 1500);
        });
      } catch {
        // réseau indisponible : mode local
      }
    })();

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  return null;
}
