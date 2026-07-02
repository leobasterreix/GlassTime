import { NextResponse } from "next/server";
import { getMovieReviews } from "@/lib/catalog";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const reviews = await getMovieReviews(Number(id));
  return NextResponse.json(reviews ?? []);
}
