import { NextResponse } from "next/server";
import { getBookDetail } from "@/lib/openlibrary";
import type { Book } from "@/lib/types";

/**
 * Fiches complètes de plusieurs livres en un seul aller-retour réseau,
 * au lieu d'un fetch client par livre suivi (utilisé par useHydrateLibrary).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const books = await Promise.all(ids.map((id) => getBookDetail(id)));
  return NextResponse.json(books.filter((b): b is Book => b !== null), {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
