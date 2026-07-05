import { NextResponse } from "next/server";
import { getEpisodeAirTimes } from "@/lib/trakt";

/** Horaires réels (Trakt) pour plusieurs séries à la fois, par ID TMDB —
 * sert à rafraîchir les séries déjà en cache côté client (suivies avant
 * l'ajout de Trakt, donc toujours sur date seule). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));

  const entries = await Promise.all(
    ids.map(async (id) => [id, await getEpisodeAirTimes(id)] as const)
  );
  const result = Object.fromEntries(entries.filter(([, times]) => Object.keys(times).length > 0));
  return NextResponse.json(result);
}
