import { NextResponse } from "next/server";
import { getMovieDetail } from "@/lib/catalog";
import type { Movie } from "@/lib/types";

/**
 * Fiches complètes de plusieurs films en un seul aller-retour réseau,
 * au lieu d'un fetch client par film suivi (utilisé par useHydrateLibrary).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));

  const movies = await Promise.all(ids.map((id) => getMovieDetail(id)));
  return NextResponse.json(movies.filter((m): m is Movie => m !== null), {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
