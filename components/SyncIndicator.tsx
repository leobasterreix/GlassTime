"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { syncStatus } from "@/lib/syncStatus";

const LABELS: Record<string, string> = {
  idle: "",
  syncing: "Synchronisation…",
  synced: "Synchronisé",
  error: "Erreur de sync",
  offline: "Hors ligne",
};

function useSyncState() {
  return useSyncExternalStore(
    syncStatus.subscribe,
    syncStatus.get,
    () => "idle" as const,
  );
}

/**
 * Petit badge cloud affiché dans le header Profil.
 * Il n'apparaît que quand l'utilisateur est connecté.
 */
export default function SyncIndicator() {
  const status = useSyncState();
  const [visible, setVisible] = useState(false);

  // Show on status change, auto-hide "synced" after 2.5s
  useEffect(() => {
    if (status === "idle") {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (status === "synced") {
      const t = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (!visible) return null;

  const color =
    status === "synced"
      ? "var(--accent)"
      : status === "error"
        ? "#ef4444"
        : status === "offline"
          ? "var(--text-3)"
          : "var(--text-2)";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 20,
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        fontSize: 11.5,
        fontWeight: 600,
        color,
        transition: "opacity 0.3s, transform 0.3s",
        animation: "sync-pop 0.3s ease",
      }}
    >
      {status === "syncing" ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: "spin 1s linear infinite" }}
        >
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
      ) : status === "synced" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : status === "error" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0119 12.55" /><path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
        </svg>
      )}
      {LABELS[status]}
    </div>
  );
}
