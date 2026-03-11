import { NextResponse } from "next/server";
import { insertMarketSnapshot, listLatestMarketData } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body?.rows) ? body.rows : [];

  if (rows.length === 0) {
    insertMarketSnapshot([
      {
        symbol: "DEMO",
        price: 0,
        changePct: 0,
        volume: 0,
        raw: { note: "Empty snapshot payload" },
      },
    ]);
  } else {
    insertMarketSnapshot(rows, body?.source ?? "ui");
  }

  return NextResponse.json({ ok: true, inserted: rows.length || 1 });
}

export async function GET() {
  return NextResponse.json({ ok: true, data: listLatestMarketData() });
}
