import { NextResponse } from "next/server";
import { getShowDetail } from "@/lib/catalog";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const show = await getShowDetail(Number(id));
  if (!show)
    return NextResponse.json({ error: "Série introuvable" }, { status: 404 });
  return NextResponse.json(show, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
