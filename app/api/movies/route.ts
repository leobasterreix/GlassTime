import { NextRequest, NextResponse } from "next/server";
import { listMovies } from "@/lib/catalog";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  return NextResponse.json(await listMovies(q));
}
