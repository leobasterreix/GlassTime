"use client";

import Link from "next/link";
import { useState } from "react";
import type { Episode, Movie, Show } from "@/lib/types";
import { epLabel } from "@/lib/utils";

export type TonightCandidate =
  | { kind: "show"; key: string; show: Show; ep: Episode; runtime: number }
  | { kind: "movie"; key: string; movie: Movie; runtime: number };

/** Créneaux de temps disponibles. Les bornes sont volontairement larges
 * (30 min → 40) : un épisode de 38 min doit rentrer dans « ≈ 30 min ». */
const SLOTS = [
  { label: "≈ 30 min", emoji: "⚡", max: 40 },
  { label: "≈ 1 h", emoji: "🌗", max: 75 },
  { label: "Soirée", emoji: "🌙", max: 240 },
  { label: "Peu importe", emoji: "🎲", max: Infinity },
];

function pickRandom(
  pool: TonightCandidate[],
  avoidKey?: string
): TonightCandidate | null {
  if (pool.length === 0) return null;
  const options =
    pool.length > 1 && avoidKey ? pool.filter((c) => c.key !== avoidKey) : pool;
  return options[Math.floor(Math.random() * options.length)];
}

/** « Ce soir, je regarde quoi ? » — pioche une suggestion dans ce qu'il y a
 * à rattraper (prochain épisode des séries actives, films de la watchlist)
 * en fonction du temps disponible. Tout est local : aucun appel réseau. */
export default function TonightPicker({
  candidates,
}: {
  candidates: TonightCandidate[];
}) {
  const [open, setOpen] = useState(false);
  const [slotIdx, setSlotIdx] = useState<number | null>(null);
  const [pick, setPick] = useState<TonightCandidate | null>(null);

  const pool =
    slotIdx === null
      ? []
      : candidates.filter((c) => c.runtime <= SLOTS[slotIdx].max);

  function choose(idx: number) {
    setSlotIdx(idx);
    const nextPool = candidates.filter((c) => c.runtime <= SLOTS[idx].max);
    setPick(pickRandom(nextPool));
  }

  function close() {
    setOpen(false);
    setSlotIdx(null);
    setPick(null);
  }

  const poster =
    pick?.kind === "show" ? pick.show.poster : pick?.kind === "movie" ? pick.movie.poster : null;
  const title = pick?.kind === "show" ? pick.show.title : pick?.kind === "movie" ? pick.movie.title : "";
  const href =
    pick?.kind === "show" ? `/show/${pick.show.id}` : pick?.kind === "movie" ? `/movie/${pick.movie.id}` : "";
  const subtitle =
    pick?.kind === "show"
      ? `${epLabel(pick.ep)} — ${pick.ep.title}`
      : pick?.kind === "movie"
      ? `Film · ${pick.movie.year}`
      : "";

  return (
    <>
      <button
        className="glass card pressable"
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontWeight: 800,
          fontSize: 15,
          marginBottom: 16,
          background: "var(--accent-wash)",
          borderColor: "var(--accent)",
          color: "var(--accent)",
        }}
      >
        🎲 Ce soir, je regarde quoi ?
      </button>

      {open && (
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            className="glass-strong"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 22,
              padding: 20,
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div
              className="row"
              style={{ justifyContent: "space-between", marginBottom: 14 }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                🎲 Ce soir, je regarde quoi ?
              </h2>
              <button
                onClick={close}
                aria-label="Fermer"
                className="pressable"
                style={{
                  border: "none",
                  background: "var(--track)",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  fontSize: 15,
                  cursor: "pointer",
                  color: "var(--text-2)",
                }}
              >
                ✕
              </button>
            </div>

            <p className="tiny" style={{ marginBottom: 10, color: "var(--text-3)" }}>
              Combien de temps as-tu devant toi ?
            </p>
            <div className="row" style={{ flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {SLOTS.map((slot, i) => (
                <button
                  key={slot.label}
                  className={`chip ${slotIdx === i ? "active" : ""}`}
                  onClick={() => choose(i)}
                >
                  {slot.emoji} {slot.label}
                </button>
              ))}
            </div>

            {slotIdx !== null && pick === null && (
              <div className="glass card" style={{ textAlign: "center" }}>
                <span className="muted">
                  Rien ne tient dans ce créneau — essaie un créneau plus long.
                </span>
              </div>
            )}

            {pick && (
              <>
                <div className="glass card row" style={{ gap: 14, alignItems: "center" }}>
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={poster}
                      alt=""
                      style={{
                        width: 72,
                        height: 108,
                        objectFit: "cover",
                        borderRadius: 12,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 72,
                        height: 108,
                        borderRadius: 12,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 30,
                        background: "var(--track)",
                      }}
                    >
                      {pick.kind === "show" ? "📺" : "🎬"}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
                    <div className="tiny" style={{ marginTop: 3 }}>{subtitle}</div>
                    <div className="tiny" style={{ marginTop: 3, color: "var(--text-3)" }}>
                      ~{pick.runtime} min
                      {pool.length > 1 &&
                        ` · ${pool.length} options dans ce créneau`}
                    </div>
                  </div>
                </div>

                <div className="row" style={{ gap: 10, marginTop: 14 }}>
                  <button
                    className="btn pressable"
                    style={{ flex: 1 }}
                    onClick={() => setPick(pickRandom(pool, pick.key))}
                  >
                    🎲 Une autre
                  </button>
                  <Link
                    href={href}
                    className="btn btn-primary pressable"
                    style={{ flex: 1, textAlign: "center" }}
                    onClick={close}
                  >
                    C&apos;est parti →
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
