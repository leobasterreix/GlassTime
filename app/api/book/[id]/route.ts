import { NextResponse } from "next/server";
import { getBookDetail } from "@/lib/openlibrary";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const book = await getBookDetail(id);
  if (!book)
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  return NextResponse.json(book, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
