import { NextResponse } from "next/server";
import { getShowDetail } from "@/lib/catalog";
import type { Show } from "@/lib/types";

/**
 * Fiches complètes de plusieurs séries en un seul aller-retour réseau,
 * au lieu d'un fetch client par série suivie (utilisé par useHydrateLibrary).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));

  const shows = await Promise.all(ids.map((id) => getShowDetail(id)));
  return NextResponse.json(shows.filter((s): s is Show => s !== null), {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
