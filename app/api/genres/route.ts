import { NextResponse } from "next/server";
import { listGenres } from "@/lib/catalog";

export async function GET() {
  return NextResponse.json(await listGenres());
}
