import { NextResponse } from "next/server";
import { getShowReviews } from "@/lib/catalog";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const reviews = await getShowReviews(Number(id));
  return NextResponse.json(reviews ?? []);
}
