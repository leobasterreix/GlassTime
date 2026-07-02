"use client";

import Link from "next/link";
import Poster from "@/components/Poster";
import { useHydrateLibrary } from "@/lib/client";
import { useMounted, useTrack } from "@/lib/store";
import { allEpisodes, DAY, epLabel, fmtDateLong, fmtRelative } from "@/lib/utils";
import type { Episode, Show } from "@/lib/types";

type Entry = { show: Show; ep: Episode };

export default function CalendarPage() {
  const mounted = useMounted();
  const { followed, showCache } = useTrack();
  useHydrateLibrary();

  if (!mounted) {
    return (
      <main className="page">
        <h1 className="page-title">Agenda</h1>
        <p className="page-sub">Prochaines diffusions</p>
      </main>
    );
  }

  const source = followed.map((id) => showCache[id]).filter(Boolean);
  const now = Date.now();
  const horizon = now + 45 * DAY;

  const entries: Entry[] = source.flatMap((show) =>
    allEpisodes(show)
      .filter((ep) => ep.airDate)
      .map((ep) => ({ show, ep }))
  );

  const upcoming = entries
    .filter(({ ep }) => {
      const t = new Date(ep.airDate!).getTime();
      return t > now && t <= horizon;
    })
    .sort(
      (a, b) =>
        new Date(a.ep.airDate!).getTime() - new Date(b.ep.airDate!).getTime()
    );

  const recent = entries
    .filter(({ ep }) => {
      const t = new Date(ep.airDate!).getTime();
      return t <= now && t > now - 7 * DAY;
    })
    .sort(
      (a, b) =>
        new Date(b.ep.airDate!).getTime() - new Date(a.ep.airDate!).getTime()
    );

  // Regroupement par jour
  const byDay = new Map<string, Entry[]>();
  for (const entry of upcoming) {
    const day = entry.ep.airDate!.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }

  return (
    <main className="page">
      <h1 className="page-title">Agenda</h1>
      <p className="page-sub">Diffusions de vos séries suivies</p>

      {followed.length === 0 ? (
        <div className="glass empty">
          <div className="big">🗓️</div>
          <p className="muted" style={{ marginBottom: 18 }}>
            Suivez des séries pour voir leurs prochaines diffusions ici.
          </p>
          <Link href="/discover" className="btn btn-primary pressable">
            Découvrir des séries
          </Link>
        </div>
      ) : byDay.size === 0 && recent.length === 0 ? (
        <div className="glass empty">
          <div className="big">🗓️</div>
          <p className="muted">
            Aucune diffusion prévue prochainement pour vos séries.
          </p>
        </div>
      ) : (
        <>
          {recent.length > 0 && (
            <>
              <h2 className="section-title">Cette semaine</h2>
              <div className="stack stack-wide">
                {recent.map(({ show, ep }) => (
                  <EntryRow key={`${show.id}-${ep.s}:${ep.e}`} show={show} ep={ep} />
                ))}
              </div>
            </>
          )}
          {Array.from(byDay.entries()).map(([day, dayEntries]) => (
            <div key={day}>
              <h2 className="section-title" style={{ textTransform: "capitalize" }}>
                {fmtDateLong(day)}
                <small>{fmtRelative(day)}</small>
              </h2>
              <div className="stack stack-wide">
                {dayEntries.map(({ show, ep }) => (
                  <EntryRow key={`${show.id}-${ep.s}:${ep.e}`} show={show} ep={ep} />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}

function EntryRow({ show, ep }: Entry) {
  return (
    <Link href={`/show/${show.id}`} className="glass card pressable row">
      <Poster item={show} mini />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15.5 }}>{show.title}</div>
        <div className="muted" style={{ marginTop: 2 }}>
          {epLabel(ep)} — {ep.title}
        </div>
      </div>
      <span className="badge-pill">{fmtRelative(ep.airDate!)}</span>
    </Link>
  );
}
