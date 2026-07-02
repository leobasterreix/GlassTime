import { NextRequest, NextResponse } from "next/server";
import { listShows } from "@/lib/catalog";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const genre = req.nextUrl.searchParams.get("genre") ?? undefined;
  return NextResponse.json(await listShows(q, genre));
}
