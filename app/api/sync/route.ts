import { NextRequest, NextResponse } from "next/server";
import { kvConfigured, kvGet, kvSet } from "@/lib/kv";

const KEY = "glasstime:state";

export async function GET() {
  if (!kvConfigured()) return NextResponse.json({ configured: false });
  try {
    const raw = await kvGet(KEY);
    return NextResponse.json({
      configured: true,
      state: raw ? JSON.parse(raw) : null,
    });
  } catch (err) {
    console.error("Sync GET :", err);
    return NextResponse.json({ error: "KV indisponible" }, { status: 503 });
  }
}

export async function PUT(req: NextRequest) {
  if (!kvConfigured())
    return NextResponse.json({ error: "KV non configuré" }, { status: 503 });
  try {
    const body = await req.json();
    if (!body?.state || typeof body.state !== "object")
      return NextResponse.json({ error: "État invalide" }, { status: 400 });
    await kvSet(KEY, JSON.stringify(body.state));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Sync PUT :", err);
    return NextResponse.json({ error: "KV indisponible" }, { status: 503 });
  }
}
