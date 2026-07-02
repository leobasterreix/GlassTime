import { NextResponse } from "next/server";
import { getMovieDetail } from "@/lib/catalog";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const movie = await getMovieDetail(Number(id));
  if (!movie)
    return NextResponse.json({ error: "Film introuvable" }, { status: 404 });
  return NextResponse.json(movie);
}
