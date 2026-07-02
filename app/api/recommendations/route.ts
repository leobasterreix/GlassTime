import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "@/lib/catalog";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") === "movie" ? "movie" : "tv";
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  return NextResponse.json(await getRecommendations(type, ids));
}
