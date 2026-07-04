import { NextResponse } from "next/server";
import { getShowsStatus } from "@/lib/catalog";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));

  const statuses = await getShowsStatus(ids);
  return NextResponse.json(statuses);
}
